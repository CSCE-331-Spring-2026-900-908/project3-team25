import com.formdev.flatlaf.FlatDarkLaf;
import com.formdev.flatlaf.FlatLightLaf;

import javax.swing.*;
import javax.swing.border.EmptyBorder;
import javax.swing.border.TitledBorder;
import javax.swing.event.DocumentEvent;
import javax.swing.event.DocumentListener;
import javax.swing.table.DefaultTableCellRenderer;
import javax.swing.table.DefaultTableModel;
import javax.swing.table.JTableHeader;
import javax.swing.table.TableCellRenderer;
import javax.swing.table.TableRowSorter;
import java.awt.*;
import java.awt.event.*;
import java.math.BigDecimal;
import java.sql.*;
import java.text.DecimalFormat;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

/**
 * Graphical cashier interface for creating customer orders,
 * managing cart items, applying drink options, and submitting
 * transactions to the database.
 */
public class CashierApp extends JFrame {

    private final UserSession session;

    // ======== DB ========
    private static final String DB_URL_DEFAULT = "jdbc:postgresql://csce-315-db.engr.tamu.edu:5432/team_25_db";
    private static DbCreds CREDS;

    // ======== UI THEME ========
    private static final Color MAROON = new Color(0x5A, 0x00, 0x1B);
    private static final Color MAROON_DARK = new Color(0x3E, 0x00, 0x12);
    private static final Color MAROON_SOFT = new Color(0x7A, 0x1A, 0x35);
    private static final Color PANEL_BG = new Color(0xFA, 0xF7, 0xF8);

    private static final DecimalFormat DF = new DecimalFormat("#,##0.00");

    // ======== Pages ========
    private final CardLayout contentLayout = new CardLayout();
    private final JPanel contentPanel = new JPanel(contentLayout);

    private final JLabel statusLabel = new JLabel("Ready");
    private final JProgressBar busyBar = new JProgressBar();

    // top bar controls
    private final JLabel titleLabel = new JLabel("TEAM 25 - CASHIER");
    private final JLabel subtitleLabel = new JLabel("Order Station");
    private final JButton managerBtn = new JButton("Open Manager");
    private final JButton refreshBtn = new JButton("Refresh");
    private final JButton logoutBtn = new JButton("Logout");
    private final JToggleButton themeToggle = new JToggleButton("Dark");

    // left
    private final JPanel sidebar = new JPanel(null);
    private final JPanel navButtons = new JPanel();
    private final ButtonGroup navGroup = new ButtonGroup();
    private final JPanel navIndicator = new JPanel();
    private javax.swing.Timer indicatorTimer;
    private int indicatorYTarget = 0;

    // shared search
    private JTextField searchField;

    // order page widgets
    private JTable productsTable;
    private DefaultTableModel productsModel;
    private TableRowSorter<DefaultTableModel> productsSorter;
    private JComboBox<String> categoryFilter;

    private JTable cartTable;
    private DefaultTableModel cartModel;

    private JSlider sugarSlider;
    private JSlider iceSlider;
    private JCheckBox addBobaCheck;
    private JSpinner qtySpinner;
    private JComboBox<String> paymentMethod;

    private JLabel totalLabel;

    // cashier selection
    private JComboBox<CashierRow> cashierSelect;

    // glass
    private final LoadingGlassPane loading = new LoadingGlassPane();

    // cart in-memory
    private final List<CartLine> cart = new ArrayList<>();

    // cache lookup for special inventory items
    private Integer sugarInventoryId = null;
    private Integer iceInventoryId = null;

    // constants for extra boba
    private static final int EXTRA_BOBA_PRODUCT_ID = 16;
    private static final BigDecimal EXTRA_BOBA_PRICE = new BigDecimal("0.75");

    /**
     * Creates the cashier application window for the logged-in employee.
     *
     * @param creds database credentials for application queries
     * @param session authenticated cashier session
     */
    public CashierApp(LauncherApp.DbCreds creds, UserSession session) {
        super("Team 25 Cashier");
        this.session = session;
        CREDS = new DbCreds(creds.url(), creds.user(), creds.pass());

        setDefaultCloseOperation(JFrame.EXIT_ON_CLOSE);
        setMinimumSize(new Dimension(1280, 760));
        setLocationRelativeTo(null);

        setGlassPane(loading);
        loading.setVisible(false);

        FlatLightLaf.setup();
        installGlobalUI();

        setLayout(new BorderLayout());
        add(buildTopBar(), BorderLayout.NORTH);
        add(buildMain(), BorderLayout.CENTER);
        add(buildBottomBar(), BorderLayout.SOUTH);

        contentPanel.add(buildOrderPage(), "order");
        contentPanel.add(buildHistoryPage(), "history");
        contentPanel.add(buildInventoryPeekPage(), "inventory");
        contentLayout.show(contentPanel, "order");

        subtitleLabel.setText("Logged in: " + session.firstName() + " " + session.lastName() + " - " + session.role());
        if (session == null || !"Manager".equalsIgnoreCase(session.role())) managerBtn.setVisible(false);

        runDb("Loading products...", this::loadProducts);
        runDb("Loading cashiers...", this::loadCashiers);
        runDb("Resolving inventory IDs...", this::resolveSugarAndIceInventoryIds);

        getRootPane().registerKeyboardAction(e -> refreshCurrentPage(),
                KeyStroke.getKeyStroke(KeyEvent.VK_R, InputEvent.CTRL_DOWN_MASK),
                JComponent.WHEN_IN_FOCUSED_WINDOW);

        getRootPane().registerKeyboardAction(e -> {
                    if (searchField != null) {
                        searchField.requestFocusInWindow();
                        searchField.selectAll();
                    }
                },
                KeyStroke.getKeyStroke(KeyEvent.VK_F, InputEvent.CTRL_DOWN_MASK),
                JComponent.WHEN_IN_FOCUSED_WINDOW);
    }

    private void logout() {
        int res = JOptionPane.showConfirmDialog(
                this,
                "Log out and return to Employee Login?",
                "Logout",
                JOptionPane.OK_CANCEL_OPTION,
                JOptionPane.QUESTION_MESSAGE
        );
        if (res != JOptionPane.OK_OPTION) return;

        LauncherApp.relaunchToEmployeeLogin(this, new LauncherApp.DbCreds(CREDS.url, CREDS.user, CREDS.pass));
    }

    // ===================== UI BUILD =====================

    private JComponent buildTopBar() {
        JPanel bar = new JPanel(new BorderLayout());
        bar.setBorder(new EmptyBorder(14, 16, 14, 16));
        bar.setBackground(Color.white);

        JPanel left = new JPanel(new GridLayout(2, 1));
        left.setOpaque(false);
        titleLabel.setFont(titleLabel.getFont().deriveFont(Font.BOLD, 18f));
        titleLabel.setForeground(MAROON);
        subtitleLabel.setForeground(new Color(90, 90, 90));
        left.add(titleLabel);
        left.add(subtitleLabel);

        JPanel right = new JPanel(new FlowLayout(FlowLayout.RIGHT, 10, 0));
        right.setOpaque(false);

        stylePrimaryButton(managerBtn);
        stylePrimaryButton(refreshBtn);
        styleToggle(themeToggle);

        managerBtn.addActionListener(e -> openManagerApp());
        refreshBtn.addActionListener(e -> refreshCurrentPage());
        themeToggle.addActionListener(e -> toggleTheme());

        right.add(managerBtn);
        right.add(refreshBtn);
        right.add(themeToggle);
        right.add(logoutBtn);

        bar.add(left, BorderLayout.WEST);
        bar.add(right, BorderLayout.EAST);

        return bar;
    }

    private JComponent buildMain() {
        JPanel main = new JPanel(new BorderLayout());
        main.setBackground(PANEL_BG);

        // Sidebar removed -- cashier view is order-only.
        main.add(contentPanel, BorderLayout.CENTER);

        return main;
    }

    private JComponent buildSidebar() {
        sidebar.setPreferredSize(new Dimension(250, 10));
        sidebar.setBackground(MAROON_DARK);

        JLabel brand = new JLabel("  Cashier Station");
        brand.setForeground(Color.white);
        brand.setFont(brand.getFont().deriveFont(Font.BOLD, 16f));
        brand.setBounds(16, 16, 220, 24);
        sidebar.add(brand);

        searchField = new JTextField();
        searchField.putClientProperty("JTextField.placeholderText", "Search products... (Ctrl+F)");
        searchField.setBounds(16, 52, 218, 34);
        sidebar.add(searchField);

        navButtons.setOpaque(false);
        navButtons.setLayout(new BoxLayout(navButtons, BoxLayout.Y_AXIS));
        navButtons.setBounds(16, 100, 218, 400);
        sidebar.add(navButtons);

        navIndicator.setBackground(new Color(255, 255, 255, 180));
        navIndicator.setBounds(6, 110, 6, 44);
        sidebar.add(navIndicator);

        addNavItem("New Order", "order");
        addNavItem("Transaction History", "history");
        addNavItem("Inventory Peek", "inventory");

        searchField.getDocument().addDocumentListener(new DocumentListener() {
            @Override public void insertUpdate(DocumentEvent e) { applyProductFilter(); }
            @Override public void removeUpdate(DocumentEvent e) { applyProductFilter(); }
            @Override public void changedUpdate(DocumentEvent e) { applyProductFilter(); }
        });

        return sidebar;
    }

    private void addNavItem(String label, String pageKey) {
        JToggleButton btn = new JToggleButton(label);
        btn.setAlignmentX(Component.LEFT_ALIGNMENT);
        btn.setMaximumSize(new Dimension(218, 44));
        btn.setPreferredSize(new Dimension(218, 44));
        btn.setFocusable(false);

        btn.setForeground(Color.white);
        btn.setBackground(new Color(0, 0, 0, 0));
        btn.setBorder(BorderFactory.createEmptyBorder(10, 12, 10, 12));
        btn.setHorizontalAlignment(SwingConstants.LEFT);

        btn.addActionListener(e -> {
            contentLayout.show(contentPanel, pageKey);
            animateIndicatorTo(btn.getY() + navButtons.getY());
            subtitleLabel.setText(label);
            refreshCurrentPage();
        });

        btn.addMouseListener(new MouseAdapter() {
            @Override public void mouseEntered(MouseEvent e) {
                if (!btn.isSelected()) btn.setBackground(new Color(255, 255, 255, 25));
            }
            @Override public void mouseExited(MouseEvent e) {
                if (!btn.isSelected()) btn.setBackground(new Color(0, 0, 0, 0));
            }
        });

        btn.addItemListener(e -> {
            if (btn.isSelected()) {
                btn.setBackground(new Color(255, 255, 255, 35));
                btn.setFont(btn.getFont().deriveFont(Font.BOLD));
            } else {
                btn.setBackground(new Color(0, 0, 0, 0));
                btn.setFont(btn.getFont().deriveFont(Font.PLAIN));
            }
        });

        navGroup.add(btn);
        navButtons.add(btn);
        navButtons.add(Box.createVerticalStrut(8));

        if (navGroup.getSelection() == null) {
            btn.setSelected(true);
            contentLayout.show(contentPanel, pageKey);
            SwingUtilities.invokeLater(() -> animateIndicatorTo(btn.getY() + navButtons.getY()));
        }
    }

    private void animateIndicatorTo(int yTarget) {
        indicatorYTarget = yTarget;
        if (indicatorTimer != null && indicatorTimer.isRunning()) indicatorTimer.stop();
        indicatorTimer = new javax.swing.Timer(12, null);
        indicatorTimer.addActionListener(e -> {
            int y = navIndicator.getY();
            int dy = indicatorYTarget - y;
            if (Math.abs(dy) <= 2) {
                navIndicator.setLocation(navIndicator.getX(), indicatorYTarget);
                indicatorTimer.stop();
                return;
            }
            navIndicator.setLocation(navIndicator.getX(), y + (int) Math.signum(dy) * Math.max(2, Math.abs(dy) / 6));
        });
        indicatorTimer.start();
    }

    private JComponent buildBottomBar() {
        JPanel bottom = new JPanel(new BorderLayout());
        bottom.setBorder(new EmptyBorder(8, 12, 8, 12));
        bottom.setBackground(Color.white);

        busyBar.setIndeterminate(true);
        busyBar.setVisible(false);
        busyBar.setPreferredSize(new Dimension(120, 12));

        statusLabel.setForeground(new Color(90, 90, 90));

        bottom.add(statusLabel, BorderLayout.WEST);
        bottom.add(busyBar, BorderLayout.EAST);
        return bottom;
    }

    // ===================== PAGES =====================

    // ---- category -> display label mapping ----
    private static final String[][] CATEGORIES = {
        {"milk_tea",  "Milky Series"},
        {"fruit_tea", "Fruity Beverage"},
        {"tea",       "Non Caffeinated"},
        {"coffee",    "Fresh Brew"},
        {"topping",   "Add-ons"},
        {"seasonal",  "Seasonal"},
    };

    // product grid panel (swapped when category changes)
    private JPanel productGrid;
    // all loaded products cached for grid building
    private final List<ProductRow> allProducts = new ArrayList<>();

    private JComponent buildOrderPage() {
        JPanel root = new JPanel(new BorderLayout(0, 0));
        root.setBackground(PANEL_BG);

        // ============================================================
        // LEFT -- Order window
        // ============================================================
        JPanel leftPanel = new JPanel(new BorderLayout(0, 10));
        leftPanel.setBackground(Color.white);
        leftPanel.setBorder(BorderFactory.createCompoundBorder(
            BorderFactory.createMatteBorder(0, 0, 0, 1, new Color(220, 220, 220)),
            new EmptyBorder(16, 14, 14, 14)
        ));
        leftPanel.setPreferredSize(new Dimension(520, 0));

        // Cashier selector at top of order panel
        cashierSelect = new JComboBox<>();
        cashierSelect.setRenderer(new DefaultListCellRenderer() {
            @Override
            public Component getListCellRendererComponent(JList<?> list, Object value, int index, boolean isSelected, boolean cellHasFocus) {
                super.getListCellRendererComponent(list, value, index, isSelected, cellHasFocus);
                if (value instanceof CashierRow r) setText(r.cashierID + " - " + r.firstName + " " + r.lastName);
                return this;
            }
        });
        JPanel cashierRow = new JPanel(new BorderLayout(8, 0));
        cashierRow.setOpaque(false);
        cashierRow.add(labelMuted("Cashier:"), BorderLayout.WEST);
        cashierRow.add(cashierSelect, BorderLayout.CENTER);
        leftPanel.add(cashierRow, BorderLayout.NORTH);

        // Cart table
        cartModel = new DefaultTableModel(new Object[]{"Item", "Qty", "Unit $", "Sugar%", "Ice%", "Notes"}, 0) {
            @Override public boolean isCellEditable(int row, int col) { return false; }
        };
        cartTable = new JTable(cartModel) {
            // Auto-resize row height so long item names wrap instead of being cut off
            @Override
            public void doLayout() {
                super.doLayout();
                for (int row = 0; row < getRowCount(); row++) {
                    int maxH = getRowHeight();
                    for (int col = 0; col < getColumnCount(); col++) {
                        TableCellRenderer renderer = getCellRenderer(row, col);
                        Component comp = prepareRenderer(renderer, row, col);
                        int preferred = comp.getPreferredSize().height;
                        maxH = Math.max(maxH, preferred);
                    }
                    if (getRowHeight(row) != maxH) setRowHeight(row, maxH);
                }
            }
        };
        styleTable(cartTable);

        // Column widths: Item and Notes get the bulk of the space; others are fixed narrow
        // Columns: Item(0), Qty(1), Unit$(2), Sugar%(3), Ice%(4), Notes(5)
        cartTable.setAutoResizeMode(JTable.AUTO_RESIZE_OFF);
        cartTable.getColumnModel().getColumn(0).setPreferredWidth(160); // Item name
        cartTable.getColumnModel().getColumn(1).setPreferredWidth(35);  // Qty
        cartTable.getColumnModel().getColumn(2).setPreferredWidth(55);  // Unit $
        cartTable.getColumnModel().getColumn(3).setPreferredWidth(55);  // Sugar%
        cartTable.getColumnModel().getColumn(4).setPreferredWidth(40);  // Ice%
        cartTable.getColumnModel().getColumn(5).setPreferredWidth(155); // Notes

        // Shared wrap renderer for Item and Notes columns
        javax.swing.table.TableCellRenderer wrapRenderer = new javax.swing.table.TableCellRenderer() {
            @Override
            public Component getTableCellRendererComponent(JTable table, Object value,
                    boolean isSelected, boolean hasFocus, int row, int column) {
                JTextArea area = new JTextArea(Objects.toString(value, ""));
                area.setLineWrap(true);
                area.setWrapStyleWord(true);
                area.setOpaque(true);
                area.setBorder(new EmptyBorder(4, 8, 4, 8));
                area.setFont(table.getFont());
                if (isSelected) {
                    area.setBackground(table.getSelectionBackground());
                    area.setForeground(table.getSelectionForeground());
                } else {
                    area.setBackground(table.getBackground());
                    area.setForeground(table.getForeground());
                }
                return area;
            }
        };
        cartTable.getColumnModel().getColumn(0).setCellRenderer(wrapRenderer); // Item name
        cartTable.getColumnModel().getColumn(5).setCellRenderer(wrapRenderer); // Notes

        // Sugar% column: display the raw numeric value (can exceed 100 for 2x sweet)
        cartTable.getColumnModel().getColumn(3).setCellRenderer(new javax.swing.table.TableCellRenderer() {
            @Override
            public Component getTableCellRendererComponent(JTable table, Object value,
                    boolean isSelected, boolean hasFocus, int row, int column) {
                JLabel lbl = new JLabel(Objects.toString(value, ""), SwingConstants.CENTER);
                lbl.setOpaque(true);
                lbl.setFont(table.getFont());
                lbl.setBorder(new EmptyBorder(4, 4, 4, 4));
                if (isSelected) { lbl.setBackground(table.getSelectionBackground()); lbl.setForeground(table.getSelectionForeground()); }
                else { lbl.setBackground(table.getBackground()); lbl.setForeground(table.getForeground()); }
                return lbl;
            }
        });

        JScrollPane cartScroll = new JScrollPane(cartTable);
        cartScroll.setBorder(BorderFactory.createEmptyBorder());

        JLabel orderHeader = new JLabel("Items in the order");
        orderHeader.setFont(orderHeader.getFont().deriveFont(Font.BOLD, 13f));
        orderHeader.setForeground(MAROON);
        orderHeader.setBorder(new EmptyBorder(8, 0, 6, 0));

        JPanel cartCenter = new JPanel(new BorderLayout(0, 4));
        cartCenter.setOpaque(false);
        cartCenter.add(orderHeader, BorderLayout.NORTH);
        cartCenter.add(cartScroll, BorderLayout.CENTER);
        leftPanel.add(cartCenter, BorderLayout.CENTER);

        // Bottom of order panel: total + payment + checkout
        totalLabel = new JLabel("$0.00");
        totalLabel.setFont(totalLabel.getFont().deriveFont(Font.BOLD, 22f));
        totalLabel.setForeground(MAROON);

        paymentMethod = new JComboBox<>(new String[]{"card", "applepay", "cash"});

        JButton submitBtn = new JButton("Checkout");
        stylePrimaryButton(submitBtn);
        submitBtn.addActionListener(e -> submitOrder());

        JButton removeBtn = new JButton("Remove Item");
        styleSecondaryButton(removeBtn);
        styleSecondaryButton(logoutBtn);
        logoutBtn.addActionListener(e -> logout());
        removeBtn.addActionListener(e -> removeSelectedCartLine());

        JPanel totalRow = new JPanel(new BorderLayout(8, 0));
        totalRow.setOpaque(false);
        totalRow.add(labelMuted("Total:"), BorderLayout.WEST);
        totalRow.add(totalLabel, BorderLayout.CENTER);

        JPanel payRow = new JPanel(new BorderLayout(8, 0));
        payRow.setOpaque(false);
        payRow.add(labelMuted("Payment:"), BorderLayout.WEST);
        payRow.add(paymentMethod, BorderLayout.CENTER);

        JPanel twoSmall = new JPanel(new GridLayout(1, 2, 8, 0));
        twoSmall.setOpaque(false);
        twoSmall.add(removeBtn);
        twoSmall.add(submitBtn);

        JPanel leftBottom = new JPanel();
        leftBottom.setOpaque(false);
        leftBottom.setLayout(new BoxLayout(leftBottom, BoxLayout.Y_AXIS));
        leftBottom.add(totalRow);
        leftBottom.add(Box.createVerticalStrut(6));
        leftBottom.add(payRow);
        leftBottom.add(Box.createVerticalStrut(10));
        leftBottom.add(twoSmall);

        leftPanel.add(leftBottom, BorderLayout.SOUTH);

        // ============================================================
        // MIDDLE -- Category buttons column
        // ============================================================
        JPanel categoryCol = new JPanel();
        categoryCol.setLayout(new BoxLayout(categoryCol, BoxLayout.Y_AXIS));
        categoryCol.setBackground(MAROON_DARK);
        categoryCol.setBorder(new EmptyBorder(16, 8, 16, 8));
        categoryCol.setPreferredSize(new Dimension(130, 0));

        // Hidden fields still needed for existing logic
        categoryFilter = new JComboBox<>(new String[]{"All", "milk_tea", "tea", "fruit_tea", "coffee", "topping", "seasonal"});
        categoryFilter.setVisible(false);

        sugarSlider = new JSlider(0, 100, 100);
        sugarSlider.setVisible(false);
        iceSlider = new JSlider(0, 100, 100);
        iceSlider.setVisible(false);
        addBobaCheck = new JCheckBox();
        addBobaCheck.setVisible(false);
        qtySpinner = new JSpinner(new SpinnerNumberModel(1, 1, 20, 1));
        qtySpinner.setVisible(false);

        // Dummy non-visible products table still needed for existing addSelectedProductToCart logic
        productsModel = new DefaultTableModel(new Object[]{"ID", "Name", "Category", "Price"}, 0) {
            @Override public boolean isCellEditable(int row, int col) { return false; }
        };
        productsTable = new JTable(productsModel);
        productsSorter = new TableRowSorter<>(productsModel);
        productsTable.setRowSorter(productsSorter);

        ButtonGroup catGroup = new ButtonGroup();
        boolean[] first = {true};
        for (String[] cat : CATEGORIES) {
            String key   = cat[0];
            String label = cat[1];

            JToggleButton catBtn = new JToggleButton("<html><center>" + label + "</center></html>");
            catBtn.setAlignmentX(Component.CENTER_ALIGNMENT);
            catBtn.setMaximumSize(new Dimension(114, 64));
            catBtn.setPreferredSize(new Dimension(114, 64));
            catBtn.setFocusable(false);
            catBtn.setForeground(Color.white);
            catBtn.setBackground(new Color(0, 0, 0, 0));
            catBtn.setBorder(BorderFactory.createEmptyBorder(8, 6, 8, 6));
            catBtn.setHorizontalAlignment(SwingConstants.CENTER);

            catBtn.addItemListener(e -> {
                if (catBtn.isSelected()) {
                    catBtn.setBackground(MAROON_SOFT);
                    catBtn.setFont(catBtn.getFont().deriveFont(Font.BOLD));
                } else {
                    catBtn.setBackground(new Color(0, 0, 0, 0));
                    catBtn.setFont(catBtn.getFont().deriveFont(Font.PLAIN));
                }
            });
            catBtn.addMouseListener(new MouseAdapter() {
                @Override public void mouseEntered(MouseEvent e) { if (!catBtn.isSelected()) catBtn.setBackground(new Color(255,255,255,25)); }
                @Override public void mouseExited(MouseEvent e)  { if (!catBtn.isSelected()) catBtn.setBackground(new Color(0,0,0,0)); }
            });
            catBtn.addActionListener(e -> {
                categoryFilter.setSelectedItem(key);
                rebuildProductGrid(key);
            });

            catGroup.add(catBtn);
            categoryCol.add(catBtn);
            categoryCol.add(Box.createVerticalStrut(6));

            if (first[0]) {
                catBtn.setSelected(true);
                first[0] = false;
            }
        }

        // ============================================================
        // RIGHT -- Product grid (changes on category select)
        // ============================================================
        productGrid = new JPanel(new GridLayout(0, 3, 10, 10));
        productGrid.setBackground(PANEL_BG);

        JScrollPane gridScroll = new JScrollPane(productGrid);
        gridScroll.setBorder(BorderFactory.createEmptyBorder());
        gridScroll.getViewport().setBackground(PANEL_BG);

        JPanel rightPanel = new JPanel(new BorderLayout(0, 0));
        rightPanel.setBackground(PANEL_BG);
        rightPanel.setBorder(new EmptyBorder(16, 12, 0, 16));
        rightPanel.add(gridScroll, BorderLayout.CENTER);

        // ============================================================
        // BOTTOM ROW -- Quick mods + Modify button
        // ============================================================
        JPanel bottomBar = new JPanel(new FlowLayout(FlowLayout.LEFT, 10, 10));
        bottomBar.setBackground(Color.white);
        bottomBar.setBorder(BorderFactory.createCompoundBorder(
            BorderFactory.createMatteBorder(1, 0, 0, 0, new Color(220, 220, 220)),
            new EmptyBorder(4, 10, 4, 10)
        ));

        JLabel modLabel = new JLabel("Modify:");
        modLabel.setForeground(new Color(90, 90, 90));
        bottomBar.add(modLabel);

        // Quick mod buttons -- apply to selected cart item
        // Note: "2x Sweet" stores "200" as a flag; applyQuickMod caps sugar at 100 and adds a note instead
        String[][] quickMods = {
            {"Half Sweet",  "50",  "sugar"},
            {"2x Sweet",    "200", "sugar"},
            {"Half Ice",    "50",  "ice"},
            {"No Ice",      "0",   "ice"},
        };

        for (String[] mod : quickMods) {
            JButton mb = new JButton(mod[0]);
            styleSecondaryButton(mb);
            mb.addActionListener(e -> applyQuickMod(mod[2], mod[1]));
            bottomBar.add(mb);
        }

        // Extra Boba -- adds a separate CartLine with price rather than just a note
        JButton extraBobaBtn = new JButton("Extra Boba (+$0.75)");
        styleSecondaryButton(extraBobaBtn);
        extraBobaBtn.addActionListener(e -> applyExtraBoba());
        bottomBar.add(extraBobaBtn);

        // Separator
        JSeparator sep = new JSeparator(SwingConstants.VERTICAL);
        sep.setPreferredSize(new Dimension(1, 30));
        bottomBar.add(sep);

        // Modify button -- opens full modify panel in product grid area
        JButton modifyBtn = new JButton("Modify ▸");
        stylePrimaryButton(modifyBtn);
        modifyBtn.addActionListener(e -> showModifyPanel(rightPanel, gridScroll));
        bottomBar.add(modifyBtn);


        // ============================================================
        // ASSEMBLE
        // ============================================================
        JPanel centerAndRight = new JPanel(new BorderLayout(0, 0));
        centerAndRight.setBackground(PANEL_BG);
        centerAndRight.add(categoryCol, BorderLayout.WEST);
        centerAndRight.add(rightPanel, BorderLayout.CENTER);

        JPanel mainArea = new JPanel(new BorderLayout(0, 0));
        mainArea.setBackground(PANEL_BG);
        mainArea.add(centerAndRight, BorderLayout.CENTER);
        mainArea.add(bottomBar, BorderLayout.SOUTH);

        root.add(leftPanel, BorderLayout.WEST);
        root.add(mainArea, BorderLayout.CENTER);

        return root;
    }

    /** Rebuilds the product grid for a given category key. */
    private void rebuildProductGrid(String categoryKey) {
        productGrid.removeAll();
        for (ProductRow p : allProducts) {
            if (!p.category.equalsIgnoreCase(categoryKey)) continue;

            JButton btn = new JButton("<html><center><b>" + p.name + "</b><br><font color='gray'>$" + DF.format(p.basePrice) + "</font></center></html>");
            btn.setBackground(Color.white);
            btn.setFocusPainted(false);
            btn.setCursor(Cursor.getPredefinedCursor(Cursor.HAND_CURSOR));
            btn.setBorder(BorderFactory.createCompoundBorder(
                BorderFactory.createLineBorder(new Color(220, 220, 220), 1, true),
                new EmptyBorder(14, 8, 14, 8)
            ));
            btn.setPreferredSize(new Dimension(0, 80));

            // Hover effect
            btn.addMouseListener(new MouseAdapter() {
                @Override public void mouseEntered(MouseEvent e) { btn.setBackground(new Color(0xF1, 0xD7, 0xDD)); }
                @Override public void mouseExited(MouseEvent e)  { btn.setBackground(Color.white); }
            });

            btn.addActionListener(e -> {
                // Add directly using ProductRow data -- avoids any hidden table column truncation
                cart.add(new CartLine(p.productID, p.name, 1, p.basePrice, 100, 100, ""));
                rebuildCartTable();
            });

            productGrid.add(btn);
        }
        productGrid.revalidate();
        productGrid.repaint();
    }

    /** Selects a product row in the hidden productsTable by productID. */
    private void selectProductInTable(int productID) {
        for (int i = 0; i < productsModel.getRowCount(); i++) {
            if ((int) productsModel.getValueAt(i, 0) == productID) {
                int viewRow = productsTable.convertRowIndexToView(i);
                productsTable.setRowSelectionInterval(viewRow, viewRow);
                return;
            }
        }
    }

    /** Applies a quick modification to the currently selected cart item. */
    private void applyQuickMod(String type, String value) {
        int viewRow = cartTable.getSelectedRow();
        if (viewRow < 0) {
            JOptionPane.showMessageDialog(this, "Select an item in the order first.", "No selection", JOptionPane.WARNING_MESSAGE);
            return;
        }
        int modelRow = cartTable.convertRowIndexToModel(viewRow);
        if (modelRow < 0 || modelRow >= cart.size()) return;

        CartLine line = cart.get(modelRow);
        int newSugar = line.sugarPct;
        int newIce   = line.icePct;
        String newNote = line.note;

        switch (type) {
            case "sugar" -> {
                newSugar = Integer.parseInt(value); // allowed range 0-200
            }
            case "ice" -> {
                newIce = Integer.parseInt(value);
                String tag = (newIce == 0) ? "no ice" : newIce + "% ice";
                if (!newNote.contains(tag)) newNote = (newNote.isBlank() ? "" : newNote + ", ") + tag;
            }
        }

        cart.set(modelRow, new CartLine(line.productID, line.productName, line.quantity, line.unitPrice, newSugar, newIce, newNote));
        rebuildCartTable();
        cartTable.setRowSelectionInterval(viewRow, viewRow);
    }

    /** Adds an Extra Boba CartLine linked to the selected drink, increasing the order total. */
    private void applyExtraBoba() {
        int viewRow = cartTable.getSelectedRow();
        if (viewRow < 0) {
            JOptionPane.showMessageDialog(this, "Select a drink in the order first.", "No selection", JOptionPane.WARNING_MESSAGE);
            return;
        }
        int modelRow = cartTable.convertRowIndexToModel(viewRow);
        if (modelRow < 0 || modelRow >= cart.size()) return;

        CartLine selected = cart.get(modelRow);

        // Don't allow adding extra boba to a topping/add-on item
        if (selected.productID == EXTRA_BOBA_PRODUCT_ID) {
            JOptionPane.showMessageDialog(this, "Cannot add Extra Boba to a topping.", "Invalid", JOptionPane.WARNING_MESSAGE);
            return;
        }

        // Insert the boba add-on right after the selected drink
        CartLine bobaLine = new CartLine(EXTRA_BOBA_PRODUCT_ID, "Extra Boba Add-on",
                selected.quantity, EXTRA_BOBA_PRICE, 100, 100, "add-on for: " + selected.productName);
        cart.add(modelRow + 1, bobaLine);
        rebuildCartTable();
        cartTable.setRowSelectionInterval(viewRow, viewRow);
    }

    /** Shows the full modify panel in the right grid area. */
    private void showModifyPanel(JPanel rightPanel, JScrollPane gridScroll) {
        int viewRow = cartTable.getSelectedRow();
        if (viewRow < 0) {
            JOptionPane.showMessageDialog(this, "Select an item in the order first.", "No selection", JOptionPane.WARNING_MESSAGE);
            return;
        }
        int modelRow = cartTable.convertRowIndexToModel(viewRow);
        CartLine line = cart.get(modelRow);

        JPanel modPanel = new JPanel(new BorderLayout(12, 12));
        modPanel.setBackground(PANEL_BG);
        modPanel.setBorder(new EmptyBorder(16, 12, 12, 12));

        JLabel title = new JLabel("Modify: " + line.productName);
        title.setFont(title.getFont().deriveFont(Font.BOLD, 15f));
        title.setForeground(MAROON);
        modPanel.add(title, BorderLayout.NORTH);

        JPanel controls = new JPanel(new GridBagLayout());
        controls.setBackground(Color.white);
        controls.setBorder(BorderFactory.createCompoundBorder(
            BorderFactory.createLineBorder(new Color(220, 220, 220)),
            new EmptyBorder(16, 16, 16, 16)
        ));
        GridBagConstraints gc = new GridBagConstraints();
        gc.insets = new Insets(10, 10, 10, 10);
        gc.fill = GridBagConstraints.HORIZONTAL;
        gc.weightx = 1;

        // Sugar: 0-200 in steps of 25 (snaps to 0,25,50,75,100,125,150,175,200)
        JSlider modSugar = new JSlider(0, 200, Math.min(200, line.sugarPct));
        modSugar.setMajorTickSpacing(25);
        modSugar.setMinorTickSpacing(25);
        modSugar.setSnapToTicks(true);
        modSugar.setPaintTicks(true);
        modSugar.setPaintLabels(true);

        // Ice: 0-100 in steps of 25 (snaps to 0,25,50,75,100)
        JSlider modIce = new JSlider(0, 100, line.icePct);
        modIce.setMajorTickSpacing(25);
        modIce.setMinorTickSpacing(25);
        modIce.setSnapToTicks(true);
        modIce.setPaintTicks(true);
        modIce.setPaintLabels(true);

        JSpinner modQty = new JSpinner(new SpinnerNumberModel(line.quantity, 1, 20, 1));
        JTextField modNote = new JTextField(line.note);

        int r = 0;
        gc.gridx = 0; gc.gridy = r; gc.weightx = 0; controls.add(labelMuted("Sweetness:"), gc);
        gc.gridx = 1; gc.gridy = r++; gc.weightx = 1; controls.add(modSugar, gc);
        gc.gridx = 0; gc.gridy = r; gc.weightx = 0; controls.add(labelMuted("Ice Level:"), gc);
        gc.gridx = 1; gc.gridy = r++; gc.weightx = 1; controls.add(modIce, gc);
        gc.gridx = 0; gc.gridy = r; gc.weightx = 0; controls.add(labelMuted("Quantity:"), gc);
        gc.gridx = 1; gc.gridy = r++; gc.weightx = 1; controls.add(modQty, gc);
        gc.gridx = 0; gc.gridy = r; gc.weightx = 0; controls.add(labelMuted("Notes:"), gc);
        gc.gridx = 1; gc.gridy = r++; gc.weightx = 1; controls.add(modNote, gc);

        modPanel.add(controls, BorderLayout.CENTER);

        JPanel btnRow = new JPanel(new FlowLayout(FlowLayout.RIGHT, 10, 0));
        btnRow.setOpaque(false);

        JButton cancelBtn = new JButton("Cancel");
        JButton applyBtn  = new JButton("Apply Changes");
        styleSecondaryButton(cancelBtn);
        stylePrimaryButton(applyBtn);

        cancelBtn.addActionListener(e -> {
            rightPanel.remove(modPanel);
            rightPanel.add(gridScroll, BorderLayout.CENTER);
            rightPanel.revalidate();
            rightPanel.repaint();
        });

        applyBtn.addActionListener(e -> {
            CartLine updated = new CartLine(
                line.productID, line.productName,
                (int) modQty.getValue(),
                line.unitPrice,
                modSugar.getValue(), modIce.getValue(),
                modNote.getText().trim()
            );
            cart.set(modelRow, updated);
            rebuildCartTable();

            rightPanel.remove(modPanel);
            rightPanel.add(gridScroll, BorderLayout.CENTER);
            rightPanel.revalidate();
            rightPanel.repaint();
        });

        btnRow.add(cancelBtn);
        btnRow.add(applyBtn);
        modPanel.add(btnRow, BorderLayout.SOUTH);

        rightPanel.remove(gridScroll);
        rightPanel.add(modPanel, BorderLayout.CENTER);
        rightPanel.revalidate();
        rightPanel.repaint();
    }

    private JComponent buildHistoryPage() {
        JPanel root = new JPanel(new BorderLayout(12, 12));
        root.setBorder(new EmptyBorder(16, 16, 16, 16));
        root.setBackground(PANEL_BG);

        JPanel card = card("Recent Transactions (last 200)");
        card.setLayout(new BorderLayout(10, 10));

        DefaultTableModel model = new DefaultTableModel(
                new Object[]{"ID", "Time", "Cashier", "Total", "Pay", "Status"}, 0) {
            @Override public boolean isCellEditable(int row, int col) { return false; }
        };
        JTable table = new JTable(model);
        styleTable(table);

        JButton loadBtn = new JButton("Load / Refresh");
        stylePrimaryButton(loadBtn);
        loadBtn.addActionListener(e -> runDb("Loading transactions...", () -> loadRecentTransactions(model)));

        JPanel top = new JPanel(new BorderLayout());
        top.setOpaque(false);
        top.add(loadBtn, BorderLayout.EAST);

        card.add(top, BorderLayout.NORTH);
        card.add(new JScrollPane(table), BorderLayout.CENTER);

        root.add(card, BorderLayout.CENTER);
        return root;
    }

    private JComponent buildInventoryPeekPage() {
        JPanel root = new JPanel(new BorderLayout(12, 12));
        root.setBorder(new EmptyBorder(16, 16, 16, 16));
        root.setBackground(PANEL_BG);

        JPanel card = card("Inventory Peek (low stock)");
        card.setLayout(new BorderLayout(10, 10));

        DefaultTableModel model = new DefaultTableModel(new Object[]{"Item", "On Hand", "Reorder At", "Unit"}, 0) {
            @Override public boolean isCellEditable(int row, int col) { return false; }
        };
        JTable table = new JTable(model);
        styleTable(table);

        JButton loadBtn = new JButton("Load / Refresh");
        stylePrimaryButton(loadBtn);
        loadBtn.addActionListener(e -> runDb("Loading inventory...", () -> loadLowStock(model)));

        JPanel top = new JPanel(new BorderLayout());
        top.setOpaque(false);
        top.add(loadBtn, BorderLayout.EAST);

        card.add(top, BorderLayout.NORTH);
        card.add(new JScrollPane(table), BorderLayout.CENTER);

        root.add(card, BorderLayout.CENTER);
        return root;
    }

    // ===================== DATA LOADERS =====================

    private void loadCashiers() {
        List<CashierRow> list = new ArrayList<>();
        try (Connection conn = connect();
             PreparedStatement ps = conn.prepareStatement(
                     "SELECT cashierid, firstname, lastname FROM cashier WHERE is_active = TRUE ORDER BY cashierid")) {
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) list.add(new CashierRow(rs.getInt(1), rs.getString(2), rs.getString(3)));
            }
        } catch (SQLException ex) {
            showError("Failed to load cashiers", ex);
        }

        SwingUtilities.invokeLater(() -> {
            cashierSelect.removeAllItems();
            for (CashierRow r : list) cashierSelect.addItem(r);

            if (session != null && "Cashier".equalsIgnoreCase(session.role())) {
                for (int i = 0; i < cashierSelect.getItemCount(); i++) {
                    CashierRow r = cashierSelect.getItemAt(i);
                    if (r.cashierID == session.id()) {
                        cashierSelect.setSelectedIndex(i);
                        break;
                    }
                }
                cashierSelect.setEnabled(false);
            } else {
                cashierSelect.setEnabled(true);
                if (cashierSelect.getItemCount() > 0) cashierSelect.setSelectedIndex(0);
            }
        });
    }

    private void loadProducts() {
        List<ProductRow> list = new ArrayList<>();
        try (Connection conn = connect();
             PreparedStatement ps = conn.prepareStatement(
                     "SELECT productid, name, category, baseprice FROM product WHERE is_active = TRUE ORDER BY category, name")) {
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) list.add(new ProductRow(rs.getInt(1), rs.getString(2), rs.getString(3), rs.getBigDecimal(4)));
            }
        } catch (SQLException ex) {
            showError("Failed to load products", ex);
        }

        SwingUtilities.invokeLater(() -> {
            productsModel.setRowCount(0);
            allProducts.clear();
            for (ProductRow p : list) {
                productsModel.addRow(new Object[]{p.productID, p.name, p.category, "$" + DF.format(p.basePrice)});
                allProducts.add(p);
            }
            applyProductFilter();
            // Build the initial grid for the first category (milk_tea)
            if (productGrid != null) rebuildProductGrid("milk_tea");
        });
    }

    private void loadRecentTransactions(DefaultTableModel model) {
        model.setRowCount(0);
        String sql =
                "SELECT t.transactionid, t.transactiontime, (c.firstname || ' ' || c.lastname) AS cashier, " +
                        "t.totalamount, t.paymentmethod, t.status " +
                        "FROM transactions t JOIN cashier c ON c.cashierid = t.cashierid " +
                        "ORDER BY t.transactionid DESC LIMIT 200";
        try (Connection conn = connect();
             PreparedStatement ps = conn.prepareStatement(sql);
             ResultSet rs = ps.executeQuery()) {
            while (rs.next()) {
                model.addRow(new Object[]{
                        rs.getInt(1),
                        rs.getTimestamp(2),
                        rs.getString(3),
                        "$" + DF.format(rs.getBigDecimal(4)),
                        rs.getString(5),
                        rs.getString(6)
                });
            }
        } catch (SQLException ex) {
            showError("Failed to load transactions", ex);
        }
    }

    private void loadLowStock(DefaultTableModel model) {
        model.setRowCount(0);
        String sql =
                "SELECT itemname, quantityonhand, reorderthreshold, unit " +
                        "FROM inventory WHERE quantityonhand <= reorderthreshold " +
                        "ORDER BY (reorderthreshold - quantityonhand) DESC";
        try (Connection conn = connect();
             PreparedStatement ps = conn.prepareStatement(sql);
             ResultSet rs = ps.executeQuery()) {
            while (rs.next()) {
                model.addRow(new Object[]{
                        rs.getString(1),
                        DF.format(rs.getBigDecimal(2)),
                        DF.format(rs.getBigDecimal(3)),
                        rs.getString(4)
                });
            }
        } catch (SQLException ex) {
            showError("Failed to load inventory", ex);
        }
    }

    private void resolveSugarAndIceInventoryIds() {
        Integer sugar = null;
        Integer ice = null;

        try (Connection conn = connect()) {
            sugar = findInventoryIdByItemName(conn, "Sugar (white)");
            ice = findInventoryIdByItemName(conn, "Ice");
        } catch (SQLException ex) {
            showError("Failed to resolve Sugar/Ice inventory IDs", ex);
        }

        final Integer sugarF = sugar;
        final Integer iceF = ice;

        SwingUtilities.invokeLater(() -> {
            sugarInventoryId = sugarF;
            iceInventoryId = iceF;
        });
    }

    private Integer findInventoryIdByItemName(Connection conn, String itemName) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement("SELECT inventoryid FROM inventory WHERE itemname = ?")) {
            ps.setString(1, itemName);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) return rs.getInt(1);
            }
        }
        return null;
    }

    // ===================== ORDER FLOW =====================

    private void addSelectedProductToCart() {
        int viewRow = productsTable.getSelectedRow();
        if (viewRow < 0) {
            JOptionPane.showMessageDialog(this, "Select a product first.", "No selection", JOptionPane.WARNING_MESSAGE);
            return;
        }
        int row = productsTable.convertRowIndexToModel(viewRow);
        int productID = (int) productsModel.getValueAt(row, 0);
        String name = (String) productsModel.getValueAt(row, 1);

        String priceStr = ((String) productsModel.getValueAt(row, 3)).replace("$", "").replace(",", "");
        BigDecimal basePrice = new BigDecimal(priceStr);

        int qty = (Integer) qtySpinner.getValue();
        int sugar = sugarSlider.getValue();
        int ice = iceSlider.getValue();

        boolean addBoba = addBobaCheck.isSelected();
        String category = (String) productsModel.getValueAt(row, 2);

        cart.add(new CartLine(productID, name, qty, basePrice, sugar, ice,
                (sugar == 100 && ice == 100 ? "" : "custom")));

        if (addBoba && !"topping".equalsIgnoreCase(category)) {
            cart.add(new CartLine(EXTRA_BOBA_PRODUCT_ID, "Extra Boba Add-on", qty, EXTRA_BOBA_PRICE, 100, 100, "add-on"));
        }

        rebuildCartTable();
    }

    private void rebuildCartTable() {
        cartModel.setRowCount(0);
        for (CartLine line : cart) {
            cartModel.addRow(new Object[]{
                    line.productName,
                    line.quantity,
                    "$" + DF.format(line.unitPrice),
                    line.sugarPct,
                    line.icePct,
                    line.note
            });
        }
        updateTotal();
    }

    private void updateTotal() {
        BigDecimal total = BigDecimal.ZERO;
        for (CartLine line : cart) {
            total = total.add(line.unitPrice.multiply(BigDecimal.valueOf(line.quantity)));
        }
        totalLabel.setText("$" + DF.format(total));
    }

    private void removeSelectedCartLine() {
        int viewRow = cartTable.getSelectedRow();
        if (viewRow < 0) return;
        int modelRow = cartTable.convertRowIndexToModel(viewRow);
        if (modelRow >= 0 && modelRow < cart.size()) {
            cart.remove(modelRow);
            rebuildCartTable();
        }
    }

    private void clearCart() {
        cart.clear();
        rebuildCartTable();
    }

    private void submitOrder() {
        if (cart.isEmpty()) {
            JOptionPane.showMessageDialog(this, "Cart is empty.", "Nothing to submit", JOptionPane.WARNING_MESSAGE);
            return;
        }
        CashierRow cashier = (CashierRow) cashierSelect.getSelectedItem();
        if (cashier == null) {
            JOptionPane.showMessageDialog(this, "Select a cashier.", "Missing cashier", JOptionPane.WARNING_MESSAGE);
            return;
        }

        if (session != null && "Cashier".equalsIgnoreCase(session.role()) && cashier.cashierID != session.id()) {
            JOptionPane.showMessageDialog(
                    this,
                    "Cashier mismatch.\nPlease reload and try again.",
                    "Security check",
                    JOptionPane.ERROR_MESSAGE
            );
            return;
        }

        String paySelected = (String) paymentMethod.getSelectedItem();
        final String pay = (paySelected == null || paySelected.isBlank()) ? "card" : paySelected;

        BigDecimal total = BigDecimal.ZERO;
        for (CartLine line : cart) {
            total = total.add(line.unitPrice.multiply(BigDecimal.valueOf(line.quantity)));
        }
        final BigDecimal finalTotal = total;

        runDb("Submitting order...", () -> {
            try (Connection conn = connect()) {
                conn.setAutoCommit(false);

                int transactionID = insertTransaction(conn, cashier.cashierID, finalTotal, pay);

                for (CartLine line : cart) {
                    insertTransactionItem(conn, transactionID, line.productID, line.quantity, line.unitPrice);
                    deductInventoryForProduct(conn, line.productID, line.quantity, line.sugarPct, line.icePct);
                }

                conn.commit();

                SwingUtilities.invokeLater(() -> {
                    JOptionPane.showMessageDialog(
                            this,
                            "Order submitted!\nTransaction ID: " + transactionID + "\nTotal: $" + DF.format(finalTotal),
                            "Success",
                            JOptionPane.INFORMATION_MESSAGE
                    );
                    clearCart();
                });

            } catch (SQLException ex) {
                showError("Order failed (rolled back)", ex);
            }
        });
    }

    private int insertTransaction(Connection conn, int cashierID, BigDecimal totalAmount, String paymentMethod) throws SQLException {
        String sql =
                "INSERT INTO transactions (cashierid, transactiontime, totalamount, paymentmethod, status) " +
                        "VALUES (?, ?, ?, ?, 'completed') RETURNING transactionid";
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setInt(1, cashierID);
            ps.setTimestamp(2, Timestamp.valueOf(LocalDateTime.now()));
            ps.setBigDecimal(3, totalAmount);
            ps.setString(4, paymentMethod);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) return rs.getInt(1);
            }
        }
        throw new SQLException("Failed to insert transaction");
    }

    private void insertTransactionItem(Connection conn, int transactionID, int productID, int qty, BigDecimal unitPrice) throws SQLException {
        String sql = "INSERT INTO transactionitem (transactionid, productid, quantity, unitprice) VALUES (?, ?, ?, ?)";
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setInt(1, transactionID);
            ps.setInt(2, productID);
            ps.setInt(3, qty);
            ps.setBigDecimal(4, unitPrice);
            ps.executeUpdate();
        }
    }

    private void deductInventoryForProduct(Connection conn, int productID, int qty, int sugarPct, int icePct) throws SQLException {
        String sql = "SELECT inventoryid, amountused FROM productingredient WHERE productid = ?";
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setInt(1, productID);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    int inventoryID = rs.getInt(1);
                    BigDecimal amountUsed = rs.getBigDecimal(2);

                    BigDecimal scale = BigDecimal.ONE;
                    if (sugarInventoryId != null && inventoryID == sugarInventoryId) {
                        scale = BigDecimal.valueOf(sugarPct)
                                .divide(BigDecimal.valueOf(100), 6, java.math.RoundingMode.HALF_UP);
                    } else if (iceInventoryId != null && inventoryID == iceInventoryId) {
                        scale = BigDecimal.valueOf(icePct)
                                .divide(BigDecimal.valueOf(100), 6, java.math.RoundingMode.HALF_UP);
                    }

                    BigDecimal deduct = amountUsed
                            .multiply(BigDecimal.valueOf(qty))
                            .multiply(scale);

                    try (PreparedStatement upd = conn.prepareStatement(
                            "UPDATE inventory SET quantityonhand = quantityonhand - ? WHERE inventoryid = ?")) {
                        upd.setBigDecimal(1, deduct);
                        upd.setInt(2, inventoryID);
                        upd.executeUpdate();
                    }
                }
            }
        }
    }

    // ===================== FILTERS / REFRESH =====================

    private void applyProductFilter() {
        if (productsSorter == null) return;
        String q = (searchField != null && searchField.isVisible()) ? searchField.getText().trim().toLowerCase() : "";
        String cat = categoryFilter != null ? Objects.toString(categoryFilter.getSelectedItem(), "All") : "All";

        productsSorter.setRowFilter(new RowFilter<>() {
            @Override
            public boolean include(Entry<? extends DefaultTableModel, ? extends Integer> entry) {
                String name = Objects.toString(entry.getValue(1), "").toLowerCase();
                String category = Objects.toString(entry.getValue(2), "").toLowerCase();

                boolean matchQ = q.isEmpty() || name.contains(q) || category.contains(q);
                boolean matchCat = "All".equalsIgnoreCase(cat) || category.equalsIgnoreCase(cat);
                return matchQ && matchCat;
            }
        });
    }

    private void refreshCurrentPage() {
        runDb("Refreshing...", () -> {
            loadCashiers();
            loadProducts();
            resolveSugarAndIceInventoryIds();
        });
    }

    // ===================== MANAGER LAUNCH =====================

    private void openManagerApp() {
        if (session == null || !"Manager".equalsIgnoreCase(session.role())) {
            JOptionPane.showMessageDialog(
                    this,
                    "Only Managers can open the Manager console.",
                    "Access Denied",
                    JOptionPane.WARNING_MESSAGE
            );
            return;
        }

        SwingUtilities.invokeLater(() -> {
            try {
                statusLabel.setText("Opening Manager...");
                new ManagerApp(new LauncherApp.DbCreds(CREDS.url, CREDS.user, CREDS.pass), session).setVisible(true);
                statusLabel.setText("Manager opened.");
            } catch (Throwable t) {
                statusLabel.setText("Manager failed.");
                JOptionPane.showMessageDialog(
                        this,
                        "Manager failed to open:\n" + t,
                        "Manager launch failed",
                        JOptionPane.ERROR_MESSAGE
                );
            }
        });
    }

    // ===================== THEME =====================

    private void toggleTheme() {
        boolean dark = themeToggle.isSelected();
        try {
            if (dark) FlatDarkLaf.setup();
            else FlatLightLaf.setup();
            installGlobalUI();
            SwingUtilities.updateComponentTreeUI(this);
        } catch (Exception ex) {
            showError("Failed to switch theme", ex);
        }
    }

    private static void installGlobalUI() {
        UIManager.put("Component.arc", 14);
        UIManager.put("Button.arc", 14);
        UIManager.put("TextComponent.arc", 12);
        UIManager.put("ScrollBar.thumbArc", 999);
        UIManager.put("ScrollBar.trackArc", 999);
        UIManager.put("Table.showHorizontalLines", true);
        UIManager.put("Table.showVerticalLines", false);
        UIManager.put("Table.rowHeight", 32);

        UIManager.put("Table.selectionBackground", new Color(0xF1, 0xD7, 0xDD));
        UIManager.put("Table.selectionForeground", Color.black);

        UIManager.put("Component.focusColor", MAROON_SOFT);
    }

    // ===================== STYLING HELPERS =====================

    private JPanel card(String title) {
        JPanel p = new JPanel();
        p.setBackground(Color.white);
        TitledBorder tb = BorderFactory.createTitledBorder(
                BorderFactory.createLineBorder(new Color(230, 230, 230)),
                title
        );
        tb.setTitleColor(MAROON);
        tb.setTitleFont(UIManager.getFont("Label.font").deriveFont(Font.BOLD, 14f));
        p.setBorder(BorderFactory.createCompoundBorder(tb, new EmptyBorder(12, 12, 12, 12)));
        return p;
    }

    private JLabel labelMuted(String txt) {
        JLabel l = new JLabel(txt);
        l.setForeground(new Color(95, 95, 95));
        return l;
    }

    private void styleTable(JTable table) {
        table.setFillsViewportHeight(true);
        table.setRowHeight(34);
        table.setSelectionMode(ListSelectionModel.SINGLE_SELECTION);
        table.setShowGrid(false);
        table.setIntercellSpacing(new Dimension(0, 0));

        JTableHeader header = table.getTableHeader();
        header.setReorderingAllowed(false);
        header.setFont(header.getFont().deriveFont(Font.BOLD));

        DefaultTableCellRenderer r = new DefaultTableCellRenderer();
        r.setBorder(new EmptyBorder(0, 8, 0, 8));
        table.setDefaultRenderer(Object.class, r);

        for (int i = 0; i < table.getColumnCount(); i++) {
            String name = table.getColumnName(i).toLowerCase();
            if (name.contains("price") || name.contains("total") || name.contains("$") || name.contains("unit")) {
                DefaultTableCellRenderer rr = new DefaultTableCellRenderer();
                rr.setHorizontalAlignment(SwingConstants.RIGHT);
                rr.setBorder(new EmptyBorder(0, 8, 0, 8));
                table.getColumnModel().getColumn(i).setCellRenderer(rr);
            }
        }
    }

    private void stylePrimaryButton(JButton btn) {
        btn.setBackground(MAROON);
        btn.setForeground(Color.white);
        btn.setBorder(BorderFactory.createEmptyBorder(10, 14, 10, 14));
        btn.setFocusPainted(false);
        btn.setCursor(Cursor.getPredefinedCursor(Cursor.HAND_CURSOR));
        animateButtonBg(btn, MAROON);
    }

    private void styleSecondaryButton(JButton btn) {
        btn.setBackground(new Color(245, 245, 245));
        btn.setForeground(new Color(40, 40, 40));
        btn.setBorder(BorderFactory.createEmptyBorder(10, 14, 10, 14));
        btn.setFocusPainted(false);
        btn.setCursor(Cursor.getPredefinedCursor(Cursor.HAND_CURSOR));

        Color base = btn.getBackground();
        btn.addMouseListener(new MouseAdapter() {
            @Override public void mouseEntered(MouseEvent e) { btn.setBackground(new Color(235, 235, 235)); }
            @Override public void mouseExited(MouseEvent e) { btn.setBackground(base); }
        });
    }

    private void styleToggle(JToggleButton t) {
        t.setFocusPainted(false);
        t.setBorder(BorderFactory.createEmptyBorder(10, 14, 10, 14));
        t.setCursor(Cursor.getPredefinedCursor(Cursor.HAND_CURSOR));
        t.setBackground(new Color(245, 245, 245));
        t.addItemListener(e -> {
            if (t.isSelected()) t.setText("Light");
            else t.setText("Dark");
        });
    }

    private void animateButtonBg(JButton btn, Color base) {
        final Color hover = blend(base, Color.white, 0.14f);
        final Color press = blend(base, Color.black, 0.12f);

        btn.addMouseListener(new MouseAdapter() {
            @Override public void mouseEntered(MouseEvent e) { tweenBg(btn, btn.getBackground(), hover); }
            @Override public void mouseExited(MouseEvent e) { tweenBg(btn, btn.getBackground(), base); }
            @Override public void mousePressed(MouseEvent e) { btn.setBackground(press); }
            @Override public void mouseReleased(MouseEvent e) {
                btn.setBackground(btn.getBounds().contains(e.getPoint()) ? hover : base);
            }
        });
    }

    private void tweenBg(JComponent c, Color from, Color to) {
        javax.swing.Timer timer = new javax.swing.Timer(12, null);
        final int steps = 10;
        final int[] k = {0};
        timer.addActionListener(e -> {
            k[0]++;
            float t = Math.min(1f, k[0] / (float) steps);
            c.setBackground(lerp(from, to, t));
            if (t >= 1f) timer.stop();
        });
        timer.start();
    }

    private static Color blend(Color a, Color b, float t) {
        t = Math.max(0, Math.min(1, t));
        return new Color(
                (int) (a.getRed() + (b.getRed() - a.getRed()) * t),
                (int) (a.getGreen() + (b.getGreen() - a.getGreen()) * t),
                (int) (a.getBlue() + (b.getBlue() - a.getBlue()) * t)
        );
    }

    private static Color lerp(Color a, Color b, float t) {
        return blend(a, b, t);
    }

    // ===================== DB UTILS =====================

    private Connection connect() throws SQLException {
        Objects.requireNonNull(CREDS, "Missing DB credentials");
        return DriverManager.getConnection(CREDS.url, CREDS.user, CREDS.pass);
    }

    private void runDb(String status, Runnable task) {
        SwingUtilities.invokeLater(() -> {
            statusLabel.setText(status);
            busyBar.setVisible(true);
            loading.setVisible(true);
        });

        new Thread(() -> {
            try {
                task.run();
                SwingUtilities.invokeLater(() -> statusLabel.setText("Ready"));
            } finally {
                SwingUtilities.invokeLater(() -> {
                    busyBar.setVisible(false);
                    loading.setVisible(false);
                });
            }
        }, "db-worker").start();
    }

    private void showError(String title, Exception ex) {
        ex.printStackTrace();
        SwingUtilities.invokeLater(() -> JOptionPane.showMessageDialog(
                this,
                title + ":\n" + ex.getMessage(),
                "Error",
                JOptionPane.ERROR_MESSAGE
        ));
        SwingUtilities.invokeLater(() -> statusLabel.setText("Error: " + title));
    }

    // ======== Local creds holder ========
    private static class DbCreds {
        final String url, user, pass;
        DbCreds(String url, String user, String pass) {
            this.url = (url == null || url.isBlank()) ? DB_URL_DEFAULT : url;
            this.user = user;
            this.pass = pass;
        }
    }

    private static class ProductRow {
        final int productID;
        final String name;
        final String category;
        final BigDecimal basePrice;
        ProductRow(int productID, String name, String category, BigDecimal basePrice) {
            this.productID = productID;
            this.name = name;
            this.category = category;
            this.basePrice = basePrice;
        }
    }

    private static class CashierRow {
        final int cashierID;
        final String firstName;
        final String lastName;
        CashierRow(int cashierID, String firstName, String lastName) {
            this.cashierID = cashierID;
            this.firstName = firstName;
            this.lastName = lastName;
        }
        @Override public String toString() { return cashierID + " - " + firstName + " " + lastName; }
    }

    private static class CartLine {
        final int productID;
        final String productName;
        int quantity;
        final BigDecimal unitPrice;
        final int sugarPct;
        final int icePct;
        final String note;

        CartLine(int productID, String productName, int quantity, BigDecimal unitPrice, int sugarPct, int icePct, String note) {
            this.productID = productID;
            this.productName = productName;
            this.quantity = quantity;
            this.unitPrice = unitPrice;
            this.sugarPct = sugarPct;
            this.icePct = icePct;
            this.note = note;
        }
    }

    // ===================== LOADING GLASS =====================

    private static class LoadingGlassPane extends JComponent {
        LoadingGlassPane() {
            setOpaque(false);
            addMouseListener(new MouseAdapter() {});
        }

        @Override
        protected void paintComponent(Graphics g) {
            Graphics2D g2 = (Graphics2D) g.create();
            g2.setColor(new Color(0, 0, 0, 90));
            g2.fillRect(0, 0, getWidth(), getHeight());

            int w = 260;
            int h = 90;
            int x = (getWidth() - w) / 2;
            int y = (getHeight() - h) / 2;

            g2.setColor(Color.white);
            g2.fillRoundRect(x, y, w, h, 18, 18);
            g2.setColor(MAROON);
            g2.setStroke(new BasicStroke(2f));
            g2.drawRoundRect(x, y, w, h, 18, 18);

            g2.setFont(getFont().deriveFont(Font.BOLD, 14f));
            g2.drawString("Working...", x + 20, y + 38);

            g2.setFont(getFont().deriveFont(12f));
            g2.setColor(new Color(80, 80, 80));
            g2.drawString("Please wait", x + 20, y + 62);

            g2.dispose();
        }
    }
}