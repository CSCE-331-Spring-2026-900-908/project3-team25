import com.formdev.flatlaf.FlatDarkLaf;
import com.formdev.flatlaf.FlatLightLaf;

import javax.swing.*;
import javax.swing.border.EmptyBorder;
import javax.swing.event.DocumentEvent;
import javax.swing.event.DocumentListener;
import javax.swing.table.DefaultTableCellRenderer;
import javax.swing.table.DefaultTableModel;
import javax.swing.table.JTableHeader;
import javax.swing.table.TableRowSorter;
import java.awt.*;
import java.awt.event.*;
import java.sql.*;
import java.util.Objects;
import java.text.DecimalFormat;
import org.jfree.chart.ChartFactory;
import org.jfree.chart.ChartPanel;
import org.jfree.chart.JFreeChart;
import org.jfree.chart.plot.CategoryPlot;
import org.jfree.chart.plot.PlotOrientation;
import org.jfree.data.category.DefaultCategoryDataset;

/**
 * Graphical manager dashboard for viewing inventory, employees,
 * products, sales information, and generated business reports.
 */
public class ManagerApp extends JFrame {

    // ======== DB ========
    private static final String DB_URL_DEFAULT =
            "jdbc:postgresql://csce-315-db.engr.tamu.edu:5432/team_25_db";

    private static DbCreds CREDS;
    private final UserSession session;

    // ======== UI ========
    private static final DecimalFormat DF = new DecimalFormat("#,##0.00");

    private final CardLayout contentLayout = new CardLayout();
    private final JPanel contentPanel = new JPanel(contentLayout);

    private final JLabel statusLabel = new JLabel("Ready");
    private final JProgressBar busyBar = new JProgressBar();

    // sidebar
    private final JPanel sidebar = new JPanel(null);
    private final JPanel navButtons = new JPanel();
    private final ButtonGroup navGroup = new ButtonGroup();
    private final JPanel navIndicator = new JPanel();
    private Timer indicatorTimer;
    private int indicatorYTarget = 0;

    // top bar
    private final JLabel titleLabel = new JLabel("TEAM 25 - MANAGER");
    private final JLabel subtitleLabel = new JLabel("Restaurant Ops Dashboard");
    private final JButton refreshBtn = new JButton("Refresh");
    private final JToggleButton themeToggle = new JToggleButton("Dark");
    private final JButton logoutBtn = new JButton("Logout");

    // tables/models
    private JTable inventoryTable, employeesTable, productsTable, salesTable;
    private DefaultTableModel inventoryModel, employeesModel, productsModel, salesModel;

    // shared search
    private JTextField searchField;

    // glass
    private final LoadingGlassPane loading = new LoadingGlassPane();
    // CHARTS 
    private ChartPanel topChartPanel;
    private ChartPanel bottomChartPanel;
    private final DefaultCategoryDataset topDataset = new DefaultCategoryDataset();
    private final DefaultCategoryDataset bottomDataset = new DefaultCategoryDataset();
    private JTextField startDateField;
    private JTextField endDateField;
    private JCheckBox excludeZeroBox; // reuse it as "Exclude 0-usage"

    /**
     * Logs out the current manager and returns to the employee login screen.
     */
    private void logout() {
        int res = JOptionPane.showConfirmDialog(
                this,
                "Log out and return to Employee Login?",
                "Logout",
                JOptionPane.OK_CANCEL_OPTION,
                JOptionPane.QUESTION_MESSAGE
        );
        if (res != JOptionPane.OK_OPTION) return;

        LauncherApp.relaunchToEmployeeLogin(this, new LauncherApp.DbCreds(CREDS.url(), CREDS.user(), CREDS.pass()));
    }

    /**
     * Creates the manager dashboard window for the logged-in manager.
     *
     * @param creds database credentials for application queries
     * @param session authenticated manager session
     */
    public ManagerApp(LauncherApp.DbCreds creds, UserSession session) {
        super("Team 25 Manager");

        if (session == null || session.role() == null || !"Manager".equalsIgnoreCase(session.role())) {
            JOptionPane.showMessageDialog(
                    null,
                    "Access denied. Manager role required.",
                    "Access Denied",
                    JOptionPane.ERROR_MESSAGE
            );
            this.session = session;
            dispose();
            return;
        }

        CREDS = new DbCreds(
                (creds != null && creds.url() != null && !creds.url().isBlank()) ? creds.url() : DB_URL_DEFAULT,
                (creds != null) ? creds.user() : null,
                (creds != null) ? creds.pass() : null
        );

        this.session = session;

        FlatLightLaf.setup();
        installGlobalUI();

        setDefaultCloseOperation(JFrame.EXIT_ON_CLOSE);
        setMinimumSize(new Dimension(1200, 720));
        setLocationRelativeTo(null);

        setGlassPane(loading);
        loading.setVisible(false);

        setLayout(new BorderLayout());

        subtitleLabel.setText("Logged in: " + session.firstName() + " " + session.lastName() + " - Manager");

        add(buildTopBar(), BorderLayout.NORTH);
        add(buildMain(), BorderLayout.CENTER);
        add(buildBottomBar(), BorderLayout.SOUTH);

        contentPanel.add(buildDashboardPage(), "dashboard");
        contentPanel.add(buildInventoryPage(), "inventory");
        contentPanel.add(buildEmployeesPage(), "employees");
        contentPanel.add(buildProductsPage(), "products");
        contentPanel.add(buildSalesPage(), "sales");
        contentPanel.add(buildChartsPage(), "charts");

        contentLayout.show(contentPanel, "dashboard");

        runDb("Loading dashboard...", this::loadDashboardQuickStats);

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

    private static void installGlobalUI() {
        UIManager.put("Component.arc", 16);
        UIManager.put("Button.arc", 18);
        UIManager.put("TextComponent.arc", 14);
        UIManager.put("ProgressBar.arc", 999);
        UIManager.put("ScrollBar.width", 12);

        UIManager.put("App.accent", new Color(115, 34, 45));
        UIManager.put("App.accent2", new Color(155, 66, 78));
        UIManager.put("App.bg", new Color(245, 246, 248));
        UIManager.put("App.card", Color.WHITE);

        UIManager.put("Table.rowHeight", 28);
    }

    // ===================== LAYOUT =====================

    private JComponent buildTopBar() {
        JPanel top = new JPanel(new BorderLayout());
        top.setBackground(Color.WHITE);

        JPanel left = new JPanel();
        left.setOpaque(false);
        left.setLayout(new BoxLayout(left, BoxLayout.Y_AXIS));

        titleLabel.setFont(new Font("SansSerif", Font.BOLD, 20));
        subtitleLabel.setFont(new Font("SansSerif", Font.PLAIN, 12));
        subtitleLabel.setForeground(new Color(110, 110, 110));

        left.add(titleLabel);
        left.add(subtitleLabel);

        JPanel right = new JPanel(new FlowLayout(FlowLayout.RIGHT, 10, 0));
        right.setOpaque(false);

        themeToggle.setFocusPainted(false);
        themeToggle.addActionListener(e -> toggleTheme());

        logoutBtn.setFocusPainted(false);
        logoutBtn.addActionListener(e -> logout());
        right.add(logoutBtn);

        refreshBtn.setFocusPainted(false);
        refreshBtn.addActionListener(e -> refreshCurrentPage());

        right.add(new JLabel("Ctrl+F Search"));
        right.add(themeToggle);
        right.add(refreshBtn);

        top.add(left, BorderLayout.WEST);
        top.add(right, BorderLayout.EAST);

        top.setBorder(BorderFactory.createCompoundBorder(
                BorderFactory.createMatteBorder(0, 0, 1, 0, new Color(230, 230, 230)),
                new EmptyBorder(12, 14, 12, 14)
        ));
        return top;
    }

    private void toggleTheme() {
        boolean dark = themeToggle.isSelected();
        themeToggle.setText(dark ? "Light" : "Dark");
        try {
            if (dark) FlatDarkLaf.setup();
            else FlatLightLaf.setup();
            installGlobalUI();
            SwingUtilities.updateComponentTreeUI(this);
        } catch (Exception ex) {
            ex.printStackTrace();
        }
    }

    private JComponent buildMain() {
        JPanel main = new JPanel(new BorderLayout());
        main.setBackground((Color) UIManager.get("App.bg"));

        buildSidebar();

        JPanel center = new JPanel(new BorderLayout(12, 12));
        center.setOpaque(false);
        center.setBorder(new EmptyBorder(12, 12, 12, 12));

        searchField = new JTextField();
        searchField.putClientProperty("JTextField.placeholderText", "Search in current table (Ctrl+F)...");
        searchField.setPreferredSize(new Dimension(360, 36));
        searchField.getDocument().addDocumentListener(new DocumentListener() {
            public void insertUpdate(DocumentEvent e) { applySearch(); }
            public void removeUpdate(DocumentEvent e) { applySearch(); }
            public void changedUpdate(DocumentEvent e) { applySearch(); }
        });

        JPanel searchRow = new JPanel(new BorderLayout());
        searchRow.setOpaque(false);
        searchRow.add(searchField, BorderLayout.WEST);

        center.add(searchRow, BorderLayout.NORTH);
        center.add(wrapCard(contentPanel), BorderLayout.CENTER);

        main.add(sidebar, BorderLayout.WEST);
        main.add(center, BorderLayout.CENTER);
        return main;
    }

    private void buildSidebar() {
        sidebar.setPreferredSize(new Dimension(240, 0));
        sidebar.setBackground(new Color(20, 20, 20));

        JLabel brand = new JLabel("McBoba Ops");
        brand.setForeground(Color.WHITE);
        brand.setFont(new Font("SansSerif", Font.BOLD, 18));
        brand.setBounds(16, 16, 200, 24);

        JLabel small = new JLabel("Manager Console");
        small.setForeground(new Color(180, 180, 180));
        small.setFont(new Font("SansSerif", Font.PLAIN, 12));
        small.setBounds(16, 40, 200, 18);

        sidebar.add(brand);
        sidebar.add(small);

        navButtons.setLayout(new GridLayout(0, 1, 0, 8));
        navButtons.setOpaque(false);
        navButtons.setBounds(16, 80, 208, 520);

        navIndicator.setBackground((Color) UIManager.get("App.accent"));
        navIndicator.setBounds(10, 80, 4, 44);
        sidebar.add(navIndicator);

        addNav("Dashboard", "dashboard");
        addNav("Inventory", "inventory");
        addNav("Employees", "employees");
        addNav("Products", "products");
        addNav("Sales", "sales");
        addNav("Charts", "charts");

        sidebar.add(navButtons);

        if (navButtons.getComponentCount() > 0) {
            AbstractButton first = (AbstractButton) navButtons.getComponent(0);
            first.setSelected(true);
            indicatorYTarget = first.getY() + navButtons.getY();
            navIndicator.setLocation(navIndicator.getX(), indicatorYTarget);
        }
    }

    private void addNav(String label, String card) {
        JToggleButton btn = new JToggleButton(label);
        btn.setHorizontalAlignment(SwingConstants.LEFT);
        btn.setFocusPainted(false);
        btn.setFont(new Font("SansSerif", Font.BOLD, 13));
        btn.setForeground(Color.WHITE);
        btn.setBackground(new Color(35, 35, 35));
        btn.setOpaque(true);
        btn.setBorder(new EmptyBorder(12, 14, 12, 14));
        btn.putClientProperty("JButton.buttonType", "roundRect");

        btn.addItemListener(e -> {
            boolean selected = btn.isSelected();
            btn.setBackground(selected ? new Color(55, 55, 55) : new Color(35, 35, 35));
        });

        btn.addMouseListener(new MouseAdapter() {
            @Override public void mouseEntered(MouseEvent e) {
                if (!btn.isSelected()) btn.setBackground(new Color(45, 45, 45));
            }
            @Override public void mouseExited(MouseEvent e) {
                if (!btn.isSelected()) btn.setBackground(new Color(35, 35, 35));
            }
        });

        btn.addActionListener(e -> {
            contentLayout.show(contentPanel, card);
            animateIndicatorTo(btn.getY() + navButtons.getY());
            switch (card) {
                case "charts" -> runDb("Loading charts...", this::loadCharts);
                case "dashboard" -> runDb("Loading dashboard...", this::loadDashboardQuickStats);
                case "inventory" -> runDb("Loading inventory...", this::loadInventory);
                case "employees" -> runDb("Loading employees...", this::loadEmployees);
                case "products" -> runDb("Loading products...", this::loadProducts);
                case "sales" -> runDb("Loading sales...", this::loadSales);
            }
        });

        navGroup.add(btn);
        navButtons.add(btn);
    }

    private void animateIndicatorTo(int y) {
        indicatorYTarget = y;
        if (indicatorTimer != null && indicatorTimer.isRunning()) indicatorTimer.stop();

        indicatorTimer = new Timer(10, e -> {
            int cy = navIndicator.getY();
            int dy = indicatorYTarget - cy;
            if (Math.abs(dy) <= 2) {
                navIndicator.setLocation(navIndicator.getX(), indicatorYTarget);
                ((Timer) e.getSource()).stop();
                return;
            }
            navIndicator.setLocation(navIndicator.getX(), cy + (int) Math.signum(dy) * Math.max(2, Math.abs(dy) / 8));
        });
        indicatorTimer.start();
    }

    private JComponent buildBottomBar() {
        JPanel bottom = new JPanel(new BorderLayout());
        bottom.setBackground(Color.WHITE);

        statusLabel.setFont(new Font("SansSerif", Font.PLAIN, 12));
        statusLabel.setForeground(new Color(90, 90, 90));

        busyBar.setIndeterminate(true);
        busyBar.setVisible(false);
        busyBar.setPreferredSize(new Dimension(180, 12));

        bottom.add(statusLabel, BorderLayout.WEST);
        bottom.add(busyBar, BorderLayout.EAST);

        bottom.setBorder(BorderFactory.createCompoundBorder(
                BorderFactory.createMatteBorder(1, 0, 0, 0, new Color(230, 230, 230)),
                new EmptyBorder(8, 12, 8, 12)
        ));
        return bottom;
    }

    private JPanel wrapCard(JComponent c) {
        JPanel card = new JPanel(new BorderLayout());
        card.setOpaque(true);
        card.setBackground((Color) UIManager.get("App.card"));
        card.setBorder(BorderFactory.createCompoundBorder(
                BorderFactory.createLineBorder(new Color(230, 230, 230)),
                new EmptyBorder(12, 12, 12, 12)
        ));
        card.add(c, BorderLayout.CENTER);
        return card;
    }

    // ===================== DASHBOARD =====================

    private JPanel dashboardStats;
    private JLabel statInventory, statProducts, statEmployees, statSales;

    private JPanel buildDashboardPage() {
        JPanel p = new JPanel(new BorderLayout(12, 12));
        p.setOpaque(false);

        JLabel h = new JLabel("Dashboard");
        h.setFont(new Font("SansSerif", Font.BOLD, 20));

        dashboardStats = new JPanel(new GridLayout(1, 4, 12, 12));
        dashboardStats.setOpaque(false);

        statInventory = new JLabel("--");
        statProducts  = new JLabel("--");
        statEmployees = new JLabel("--");
        statSales     = new JLabel("--");

        dashboardStats.add(statCard("Inventory Items", statInventory));
        dashboardStats.add(statCard("Products", statProducts));
        dashboardStats.add(statCard("Employees", statEmployees));
        dashboardStats.add(statCard("Recent Sales", statSales));

        JTextArea tips = new JTextArea();
        tips.setEditable(false);
        tips.setLineWrap(true);
        tips.setWrapStyleWord(true);
        tips.setFont(new Font("SansSerif", Font.PLAIN, 13));
        tips.setText("""
                - Ctrl+F filters the visible table.
                - Ctrl+R refreshes the active page.
                - Sales page includes report dialogs.
                """);

        p.add(h, BorderLayout.NORTH);
        p.add(dashboardStats, BorderLayout.CENTER);
        p.add(wrapCard(new JScrollPane(tips)), BorderLayout.SOUTH);
        return p;
    }

    private JPanel statCard(String title, JLabel value) {
        JPanel card = new JPanel(new BorderLayout());
        card.setBackground((Color) UIManager.get("App.card"));
        card.setBorder(BorderFactory.createCompoundBorder(
                BorderFactory.createLineBorder(new Color(230, 230, 230)),
                new EmptyBorder(14, 14, 14, 14)
        ));

        JLabel t = new JLabel(title);
        t.setFont(new Font("SansSerif", Font.BOLD, 12));
        t.setForeground(new Color(110, 110, 110));

        value.setFont(new Font("SansSerif", Font.BOLD, 26));
        value.setForeground(new Color(30, 30, 30));

        card.add(t, BorderLayout.NORTH);
        card.add(value, BorderLayout.CENTER);
        return card;
    }

    private void loadDashboardQuickStats() throws Exception {
        SwingUtilities.invokeLater(() -> {
            statInventory.setText(countOrDash("inventory"));
            statProducts.setText(countOrDash("product"));
            statEmployees.setText(countSumOrDash("cashier", "manager"));
            statSales.setText(countOrDash("transactions"));
        });
    }

    private String countOrDash(String table) {
        String sql = "SELECT COUNT(*) FROM " + table;
        try (Connection conn = openConn();
             Statement st = conn.createStatement();
             ResultSet rs = st.executeQuery(sql)) {
            rs.next();
            return String.valueOf(rs.getLong(1));
        } catch (SQLException ex) {
            return "--";
        }
    }

    private String countSumOrDash(String tableA, String tableB) {
        String sql = "SELECT (SELECT COUNT(*) FROM " + tableA + ") + (SELECT COUNT(*) FROM " + tableB + ")";
        try (Connection conn = openConn();
             Statement st = conn.createStatement();
             ResultSet rs = st.executeQuery(sql)) {
            rs.next();
            return String.valueOf(rs.getLong(1));
        } catch (SQLException ex) {
            return "--";
        }
    }

    // ===================== INVENTORY =====================

    private JPanel buildInventoryPage() {
        JPanel p = new JPanel(new BorderLayout(10, 10));
        p.setOpaque(false);

        JLabel h = new JLabel("Inventory");
        h.setFont(new Font("SansSerif", Font.BOLD, 20));

        inventoryModel = new DefaultTableModel(
                new Object[]{"inventoryid", "itemname", "quantityonhand", "unit", "reorderthreshold"}, 0
        ) { @Override public boolean isCellEditable(int row, int col) { return false; } };

        inventoryTable = styledTable(inventoryModel);

        JButton reload = primaryButton("Reload");
        reload.addActionListener(e -> runDb("Loading inventory...", this::loadInventory));

        JButton add = primaryButton("Add Item");
        add.addActionListener(e -> openInventoryEditor(null));

        JButton edit = primaryButton("Edit Selected");
        edit.addActionListener(e -> {
            Integer id = getSelectedInt(inventoryTable, 0);
            if (id == null) { toast("Select an inventory row first."); return; }
            openInventoryEditor(id);
        });

        JButton restock = primaryButton("Restock (+)");
        restock.addActionListener(e -> {
            Integer id = getSelectedInt(inventoryTable, 0);
            if (id == null) { toast("Select an inventory row first."); return; }
            openInventoryRestock(id);
        });

        JPanel right = new JPanel(new FlowLayout(FlowLayout.RIGHT, 10, 0));
        right.setOpaque(false);
        right.add(add);
        right.add(edit);
        right.add(restock);
        right.add(reload);

        JPanel top = new JPanel(new BorderLayout());
        top.setOpaque(false);
        top.add(h, BorderLayout.WEST);
        top.add(right, BorderLayout.EAST);

        p.add(top, BorderLayout.NORTH);
        p.add(new JScrollPane(inventoryTable), BorderLayout.CENTER);
        return p;
    }

    private void loadInventory() throws Exception {
        inventoryModel.setRowCount(0);
        String sql = "SELECT inventoryid, itemname, quantityonhand, unit, reorderthreshold FROM inventory ORDER BY inventoryid";
        try (Connection conn = openConn();
             Statement st = conn.createStatement();
             ResultSet rs = st.executeQuery(sql)) {
            while (rs.next()) {
                inventoryModel.addRow(new Object[]{
                        rs.getInt(1), rs.getString(2), rs.getDouble(3), rs.getString(4), rs.getDouble(5)
                });
            }
        }
        loadDashboardQuickStats();
    }

    // ===================== EMPLOYEES =====================

    private JPanel buildEmployeesPage() {
        JPanel p = new JPanel(new BorderLayout(10, 10));
        p.setOpaque(false);

        JLabel h = new JLabel("Employees");
        h.setFont(new Font("SansSerif", Font.BOLD, 20));

        employeesModel = new DefaultTableModel(
                new Object[]{"id", "firstname", "lastname", "role", "hiredate", "hoursworked", "is_active"}, 0
        ) { @Override public boolean isCellEditable(int row, int col) { return false; } };

        employeesTable = styledTable(employeesModel);

        JButton reload = primaryButton("Reload");
        reload.addActionListener(e -> runDb("Loading employees...", this::loadEmployees));

        JButton add = primaryButton("Add Employee");
        add.addActionListener(e -> openEmployeeEditor(null, null));

        JButton edit = primaryButton("Edit Selected");
        edit.addActionListener(e -> {
            Integer id = getSelectedInt(employeesTable, 0);
            if (id == null) { toast("Select an employee row first."); return; }
            String role = getSelectedString(employeesTable, 3);
            openEmployeeEditor(id, role);
        });

        JButton toggle = primaryButton("Toggle Active");
        toggle.addActionListener(e -> {
            Integer id = getSelectedInt(employeesTable, 0);
            if (id == null) { toast("Select an employee row first."); return; }
            String role = getSelectedString(employeesTable, 3);
            Boolean active = getSelectedBoolean(employeesTable, 6);
            if (role == null || active == null) { toast("Select a valid employee row."); return; }
            boolean newActive = !active;
            runDb("Updating employee...", () -> {
                setEmployeeActive(id, role, newActive);
                loadEmployees();
            });
        });

        JPanel right = new JPanel(new FlowLayout(FlowLayout.RIGHT, 10, 0));
        right.setOpaque(false);
        right.add(add);
        right.add(edit);
        right.add(toggle);
        right.add(reload);

        JPanel top = new JPanel(new BorderLayout());
        top.setOpaque(false);
        top.add(h, BorderLayout.WEST);
        top.add(right, BorderLayout.EAST);

        p.add(top, BorderLayout.NORTH);
        p.add(new JScrollPane(employeesTable), BorderLayout.CENTER);
        return p;
    }

    private void loadEmployees() throws Exception {
        employeesModel.setRowCount(0);
        String sql =
                "SELECT cashierid AS id, firstname, lastname, 'Cashier' AS role, hiredate, hoursworked, is_active " +
                        "FROM cashier " +
                        "UNION ALL " +
                        "SELECT managerid AS id, firstname, lastname, 'Manager' AS role, hiredate, NULL::numeric AS hoursworked, is_active " +
                        "FROM manager " +
                        "ORDER BY role, id";
        try (Connection conn = openConn();
             Statement st = conn.createStatement();
             ResultSet rs = st.executeQuery(sql)) {
            while (rs.next()) {
                employeesModel.addRow(new Object[]{
                        rs.getInt(1), rs.getString(2), rs.getString(3), rs.getString(4),
                        rs.getDate(5), rs.getObject(6), rs.getBoolean(7)
                });
            }
        }
        loadDashboardQuickStats();
    }

    // ===================== PRODUCTS =====================

    private JPanel buildProductsPage() {
        JPanel p = new JPanel(new BorderLayout(10, 10));
        p.setOpaque(false);

        JLabel h = new JLabel("Products");
        h.setFont(new Font("SansSerif", Font.BOLD, 20));

        productsModel = new DefaultTableModel(
                new Object[]{"productid", "name", "baseprice", "category", "is_active"}, 0
        ) { @Override public boolean isCellEditable(int row, int col) { return false; } };

        productsTable = styledTable(productsModel);

        JButton reload = primaryButton("Reload");
        reload.addActionListener(e -> runDb("Loading products...", this::loadProducts));

        JButton add = primaryButton("Add Product");
        add.addActionListener(e -> openProductEditor(null));

        JButton edit = primaryButton("Edit Selected");
        edit.addActionListener(e -> {
            Integer id = getSelectedInt(productsTable, 0);
            if (id == null) { toast("Select a product row first."); return; }
            openProductEditor(id);
        });

        JButton toggle = primaryButton("Toggle Active");
        toggle.addActionListener(e -> {
            Integer id = getSelectedInt(productsTable, 0);
            if (id == null) { toast("Select a product row first."); return; }
            Boolean active = getSelectedBoolean(productsTable, 4);
            if (active == null) { toast("Select a valid product row."); return; }
            boolean newActive = !active;
            runDb("Updating product...", () -> {
                setProductActive(id, newActive);
                loadProducts();
            });
        });

        JPanel right = new JPanel(new FlowLayout(FlowLayout.RIGHT, 10, 0));
        right.setOpaque(false);
        right.add(add);
        right.add(edit);
        right.add(toggle);
        right.add(reload);

        JPanel top = new JPanel(new BorderLayout());
        top.setOpaque(false);
        top.add(h, BorderLayout.WEST);
        top.add(right, BorderLayout.EAST);

        p.add(top, BorderLayout.NORTH);
        p.add(new JScrollPane(productsTable), BorderLayout.CENTER);
        return p;
    }

    private void loadProducts() throws Exception {
        productsModel.setRowCount(0);
        String sql = "SELECT productid, name, baseprice, category, is_active FROM product ORDER BY productid";
        try (Connection conn = openConn();
             Statement st = conn.createStatement();
             ResultSet rs = st.executeQuery(sql)) {
            while (rs.next()) {
                productsModel.addRow(new Object[]{
                        rs.getInt(1), rs.getString(2), rs.getDouble(3), rs.getString(4), rs.getBoolean(5)
                });
            }
        }
        loadDashboardQuickStats();
    }

    // ===================== SALES / REPORTS =====================
private JPanel buildSalesPage() {
    JPanel p = new JPanel(new BorderLayout(10, 10));
    p.setOpaque(false);

    JLabel h = new JLabel("Sales");
    h.setFont(new Font("SansSerif", Font.BOLD, 20));

    salesModel = new DefaultTableModel(
            new Object[]{"transactionid", "transactiontime", "totalamount", "paymentmethod", "status"}, 0
    ) { @Override public boolean isCellEditable(int row, int col) { return false; } };

    // ===== Center: transactions table =====
    JTable table = styledTable(salesModel);
    JScrollPane sp = new JScrollPane(table);
    sp.setBorder(javax.swing.BorderFactory.createEmptyBorder(6, 6, 6, 6));

    JPanel top = new JPanel(new BorderLayout());
    top.setOpaque(false);
    top.add(h, BorderLayout.WEST);

    // ===== Right: actions =====
    JPanel right = new JPanel();
    right.setOpaque(false);
    right.setLayout(new BoxLayout(right, BoxLayout.Y_AXIS));

    JButton refresh = primaryButton("Refresh");
    refresh.addActionListener(e -> runDb("Loading sales...", this::loadSales));

    JButton reportX = primaryButton("X-Report (Today)");
    reportX.addActionListener(e -> runDb("Building X-report...", this::showXReportToday));

    JButton reportZ = primaryButton("Z-Report (Close Day)");
    reportZ.addActionListener(e -> runDb("Building Z-report...", this::showZReportToday));

    right.add(refresh);
    right.add(Box.createVerticalStrut(8));
    right.add(reportX);
    right.add(Box.createVerticalStrut(8));
    right.add(reportZ);
    right.add(Box.createVerticalGlue());

    p.add(top, BorderLayout.NORTH);
    p.add(sp, BorderLayout.CENTER);
    p.add(right, BorderLayout.EAST);

    return p;
}

    private void loadSales() throws Exception { loadSales("200"); }

    private void loadSales(String limitSelection) throws Exception {
        salesModel.setRowCount(0);

        String base = "SELECT transactionid, transactiontime, totalamount, paymentmethod, status " +
                "FROM transactions ORDER BY transactiontime DESC";

        String sql;
        if (limitSelection != null && limitSelection.equalsIgnoreCase("ALL")) {
            sql = base;
        } else {
            int lim = 200;
            try { lim = Integer.parseInt(String.valueOf(limitSelection)); } catch (Exception ignored) {}
            sql = base + " LIMIT " + lim;
        }

        try (Connection conn = openConn();
             Statement st = conn.createStatement();
             ResultSet rs = st.executeQuery(sql)) {
            while (rs.next()) {
                salesModel.addRow(new Object[]{
                        rs.getInt(1), rs.getTimestamp(2), rs.getDouble(3), rs.getString(4), rs.getString(5)
                });
            }
        }
        loadDashboardQuickStats();
    }

    private void showLowStockReport() throws Exception {
        String sql = "SELECT inventoryid, itemname, quantityonhand, unit, reorderthreshold " +
                "FROM inventory WHERE quantityonhand <= reorderthreshold ORDER BY (reorderthreshold - quantityonhand) DESC";
        showQueryInDialog("Low Stock Report", sql,
                new String[]{"inventoryid", "itemname", "quantityonhand", "unit", "reorderthreshold"});
    }

    private void showTopSellersReport() throws Exception {
        String sql =
                "SELECT p.productid, p.name, SUM(ti.quantity) AS units_sold, SUM(ti.quantity * ti.unitprice) AS revenue " +
                        "FROM transactionitem ti " +
                        "JOIN product p ON p.productid = ti.productid " +
                        "GROUP BY p.productid, p.name " +
                        "ORDER BY revenue DESC NULLS LAST " +
                        "LIMIT 25";
        showQueryInDialog("Top Sellers (Top 25 by Revenue)", sql,
                new String[]{"productid", "name", "units_sold", "revenue"});
    }

    private void showSalesByDayReport() throws Exception {
        String sql =
                "SELECT DATE(transactiontime) AS day, COUNT(*) AS transactions, SUM(totalamount) AS revenue " +
                        "FROM transactions " +
                        "GROUP BY DATE(transactiontime) " +
                        "ORDER BY day DESC " +
                        "LIMIT 60";
        showQueryInDialog("Sales by Day (Last 60 days)", sql,
                new String[]{"day", "transactions", "revenue"});
    }

    private void showQueryInDialog(String title, String sql, String[] cols) throws Exception {
        DefaultTableModel m = new DefaultTableModel(cols, 0) {
            @Override public boolean isCellEditable(int r, int c) { return false; }
        };
        JTable t = styledTable(m);

        try (Connection conn = openConn();
             Statement st = conn.createStatement();
             ResultSet rs = st.executeQuery(sql)) {

            int cc = cols.length;
            while (rs.next()) {
                Object[] row = new Object[cc];
                for (int i = 0; i < cc; i++) row[i] = rs.getObject(i + 1);
                m.addRow(row);
            }
        }

        JDialog d = new JDialog(this, title, true);
        d.setDefaultCloseOperation(WindowConstants.DISPOSE_ON_CLOSE);
        d.setSize(900, 520);
        d.setLocationRelativeTo(this);

        JPanel root = new JPanel(new BorderLayout(10, 10));
        root.setBorder(new EmptyBorder(12, 12, 12, 12));
        root.add(new JScrollPane(t), BorderLayout.CENTER);

        JButton close = primaryButton("Close");
        close.addActionListener(e -> d.dispose());

        JPanel bottom = new JPanel(new FlowLayout(FlowLayout.RIGHT, 10, 0));
        bottom.setOpaque(false);
        bottom.add(new JLabel("Rows: " + m.getRowCount()));
        bottom.add(close);

        root.add(bottom, BorderLayout.SOUTH);
        d.setContentPane(root);
        d.setVisible(true);
    }

    private void showXReportToday() throws Exception {
        String sql =
                "WITH hours AS (" +
                "  SELECT generate_series(0,23) AS hour_of_day" +
                "), day_tx AS (" +
                "  SELECT EXTRACT(HOUR FROM t.transactiontime)::int AS hour_of_day," +
                "         t.totalamount," +
                "         t.paymentmethod" +
                "  FROM transactions t" +
                "  WHERE t.status = 'completed'" +
                "    AND DATE(t.transactiontime) = CURRENT_DATE" +
                ")" +
                "SELECT h.hour_of_day," +
                "       COALESCE(COUNT(d.totalamount), 0) AS orders," +
                "       COALESCE(SUM(d.totalamount), 0) AS revenue," +
                "       COALESCE(SUM(CASE WHEN d.paymentmethod='cash' THEN d.totalamount ELSE 0 END), 0) AS cash_total," +
                "       COALESCE(SUM(CASE WHEN d.paymentmethod='card' THEN d.totalamount ELSE 0 END), 0) AS card_total," +
                "       COALESCE(SUM(CASE WHEN d.paymentmethod='applepay' THEN d.totalamount ELSE 0 END), 0) AS applepay_total " +
                "FROM hours h " +
                "LEFT JOIN day_tx d ON d.hour_of_day = h.hour_of_day " +
                "GROUP BY h.hour_of_day " +
                "ORDER BY h.hour_of_day;";

        showQueryInDialog(
                "X-Report (Today by Hour) - " + java.time.LocalDate.now(),
                sql,
                new String[]{"hour_of_day", "orders", "revenue", "cash_total", "card_total", "applepay_total"}
        );
    }
    private void showZReportToday() throws Exception {
    try (Connection conn = openConn()) {
        conn.setAutoCommit(false);

        // 1) Ensure Z-report log table exists (once/day enforcement)
        try (Statement st = conn.createStatement()) {
            st.execute("""
                CREATE TABLE IF NOT EXISTS z_report_log (
                  business_date  date PRIMARY KEY,
                  generated_at   timestamp NOT NULL DEFAULT now(),
                  managerid      int
                );
            """);
        }

        // 2) Block if already generated today
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT 1 FROM z_report_log WHERE business_date = CURRENT_DATE")) {
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    conn.rollback();
                    JOptionPane.showMessageDialog(
                            this,
                            "Z-Report has already been generated today.\n(Only allowed once per day.)",
                            "Z-Report",
                            JOptionPane.INFORMATION_MESSAGE
                    );
                    return;
                }
            }
        }

        // 3) Build totals for the day (similar to X-report but whole-day totals)
        String totalsSql = """
            WITH day_tx AS (
              SELECT t.totalamount, t.paymentmethod
              FROM transactions t
              WHERE t.status = 'completed'
                AND DATE(t.transactiontime) = CURRENT_DATE
            )
            SELECT
              COALESCE(COUNT(*), 0) AS orders,
              COALESCE(SUM(totalamount), 0) AS revenue,
              COALESCE(SUM(CASE WHEN paymentmethod='cash' THEN totalamount ELSE 0 END), 0) AS cash_total,
              COALESCE(SUM(CASE WHEN paymentmethod='card' THEN totalamount ELSE 0 END), 0) AS card_total,
              COALESCE(SUM(CASE WHEN paymentmethod='applepay' THEN totalamount ELSE 0 END), 0) AS applepay_total
            FROM day_tx;
        """;

        int orders;
        double revenue, cashTotal, cardTotal, applePayTotal;

        try (Statement st = conn.createStatement();
             ResultSet rs = st.executeQuery(totalsSql)) {
            rs.next();
            orders = rs.getInt("orders");
            revenue = rs.getDouble("revenue");
            cashTotal = rs.getDouble("cash_total");
            cardTotal = rs.getDouble("card_total");
            applePayTotal = rs.getDouble("applepay_total");
        }

        // Optional tax calculation (change/remove if your rubric doesn't want it)
        final double TAX_RATE = 0.0825; // 8.25% example
        double tax = revenue * TAX_RATE;
        double totalWithTax = revenue + tax;

        // 4) Display the Z-report summary (no side effects yet)
        DefaultTableModel m = new DefaultTableModel(new Object[]{"Metric", "Value"}, 0) {
            @Override public boolean isCellEditable(int r, int c) { return false; }
        };
        m.addRow(new Object[]{"Business Date", java.time.LocalDate.now().toString()});
        m.addRow(new Object[]{"Orders (completed)", orders});
        m.addRow(new Object[]{"Revenue (pre-tax)", DF.format(revenue)});
        m.addRow(new Object[]{"Tax (est.)", DF.format(tax)});
        m.addRow(new Object[]{"Total (with tax)", DF.format(totalWithTax)});
        m.addRow(new Object[]{"Cash Total", DF.format(cashTotal)});
        m.addRow(new Object[]{"Card Total", DF.format(cardTotal)});
        m.addRow(new Object[]{"Apple Pay Total", DF.format(applePayTotal)});

        JTable t = styledTable(m);

        int res = JOptionPane.showConfirmDialog(
                this,
                new JScrollPane(t),
                "Z-Report (Close Day) - " + java.time.LocalDate.now(),
                JOptionPane.OK_CANCEL_OPTION,
                JOptionPane.PLAIN_MESSAGE
        );

        if (res != JOptionPane.OK_OPTION) {
            conn.rollback();
            return; // user cancelled, so no side effects
        }

        // 5) Side effect: close today's completed sales so X-report resets to 0
        try (PreparedStatement ps = conn.prepareStatement(
                "UPDATE transactions " +
                "SET status = 'closed' " +
                "WHERE status = 'completed' " +
                "  AND DATE(transactiontime) = CURRENT_DATE")) {
            ps.executeUpdate();
        }

        // 6) Insert log row (prevents running again today)
        try (PreparedStatement ps = conn.prepareStatement(
                "INSERT INTO z_report_log(business_date, managerid) VALUES (CURRENT_DATE, ?)")) {
            ps.setInt(1, session.id()); // assumes you have session.id()
            ps.executeUpdate();
        }

        conn.commit();

        toast("Z-Report generated. Day closed. X-Report for today has been reset.");
        loadSales(); // refresh sales page table
    }
}

    // ===================== EDITORS =====================

    private void openInventoryEditor(Integer inventoryId) {
        JTextField name = new JTextField(18);
        JTextField qty = new JTextField(10);
        JTextField unit = new JTextField(10);
        JTextField reorder = new JTextField(10);

        if (inventoryId != null) {
            int viewRow = inventoryTable.getSelectedRow();
            if (viewRow >= 0) {
                int modelRow = inventoryTable.convertRowIndexToModel(viewRow);
                name.setText(String.valueOf(inventoryModel.getValueAt(modelRow, 1)));
                qty.setText(String.valueOf(inventoryModel.getValueAt(modelRow, 2)));
                unit.setText(String.valueOf(inventoryModel.getValueAt(modelRow, 3)));
                reorder.setText(String.valueOf(inventoryModel.getValueAt(modelRow, 4)));
            }
        }

        JPanel form = simpleForm(
                new String[]{"Item Name", "Quantity", "Unit", "Reorder Threshold"},
                new JComponent[]{name, qty, unit, reorder}
        );

        String title = (inventoryId == null) ? "Add Inventory Item" : "Edit Inventory Item";
        int res = JOptionPane.showConfirmDialog(this, form, title,
                JOptionPane.OK_CANCEL_OPTION, JOptionPane.PLAIN_MESSAGE);
        if (res != JOptionPane.OK_OPTION) return;

        String itemName = name.getText().trim();
        String unitStr = unit.getText().trim();
        double quantity;
        double reorderThr;

        try {
            quantity = Double.parseDouble(qty.getText().trim());
            reorderThr = Double.parseDouble(reorder.getText().trim());
        } catch (Exception ex) {
            toast("Quantity and reorder threshold must be numbers.");
            return;
        }

        if (itemName.isBlank()) { toast("Item name cannot be blank."); return; }

        runDb("Saving inventory...", () -> {
            try (Connection conn = openConn()) {
                if (inventoryId == null) {
                    String sql = "INSERT INTO inventory(itemname, quantityonhand, unit, reorderthreshold) VALUES (?,?,?,?)";
                    try (PreparedStatement ps = conn.prepareStatement(sql)) {
                        ps.setString(1, itemName);
                        ps.setDouble(2, quantity);
                        ps.setString(3, unitStr);
                        ps.setDouble(4, reorderThr);
                        ps.executeUpdate();
                    }
                } else {
                    String sql = "UPDATE inventory SET itemname=?, quantityonhand=?, unit=?, reorderthreshold=? WHERE inventoryid=?";
                    try (PreparedStatement ps = conn.prepareStatement(sql)) {
                        ps.setString(1, itemName);
                        ps.setDouble(2, quantity);
                        ps.setString(3, unitStr);
                        ps.setDouble(4, reorderThr);
                        ps.setInt(5, inventoryId);
                        ps.executeUpdate();
                    }
                }
            }
            loadInventory();
        });
    }

    private void openInventoryRestock(int inventoryId) {
        JTextField addQty = new JTextField("0", 10);
        JPanel form = simpleForm(new String[]{"Add Quantity (+)"}, new JComponent[]{addQty});
        int res = JOptionPane.showConfirmDialog(this, form, "Restock Item",
                JOptionPane.OK_CANCEL_OPTION, JOptionPane.PLAIN_MESSAGE);
        if (res != JOptionPane.OK_OPTION) return;

        double add;
        try { add = Double.parseDouble(addQty.getText().trim()); }
        catch (Exception ex) { toast("Enter a numeric quantity."); return; }

        runDb("Restocking...", () -> {
            try (Connection conn = openConn();
                 PreparedStatement ps = conn.prepareStatement(
                         "UPDATE inventory SET quantityonhand = quantityonhand + ? WHERE inventoryid = ?")) {
                ps.setDouble(1, add);
                ps.setInt(2, inventoryId);
                ps.executeUpdate();
            }
            loadInventory();
        });
    }

    private void openProductEditor(Integer productId) {
        JTextField name = new JTextField(18);
        JTextField price = new JTextField(10);
        JTextField category = new JTextField(12);
        JCheckBox active = new JCheckBox("Active");

        if (productId != null) {
            int viewRow = productsTable.getSelectedRow();
            if (viewRow >= 0) {
                int modelRow = productsTable.convertRowIndexToModel(viewRow);
                name.setText(String.valueOf(productsModel.getValueAt(modelRow, 1)));
                price.setText(String.valueOf(productsModel.getValueAt(modelRow, 2)));
                category.setText(String.valueOf(productsModel.getValueAt(modelRow, 3)));
                Object a = productsModel.getValueAt(modelRow, 4);
                active.setSelected(a instanceof Boolean b ? b : Boolean.parseBoolean(String.valueOf(a)));
            }
        } else {
            active.setSelected(true);
        }

        JPanel form = simpleForm(new String[]{"Name", "Base Price", "Category", ""}, new JComponent[]{name, price, category, active});
        String title = (productId == null) ? "Add Product" : "Edit Product";
        int res = JOptionPane.showConfirmDialog(this, form, title,
                JOptionPane.OK_CANCEL_OPTION, JOptionPane.PLAIN_MESSAGE);
        if (res != JOptionPane.OK_OPTION) return;

        String nm = name.getText().trim();
        String cat = category.getText().trim();
        double bp;

        try { bp = Double.parseDouble(price.getText().trim()); }
        catch (Exception ex) { toast("Base price must be a number."); return; }

        if (nm.isBlank()) { toast("Name cannot be blank."); return; }
        boolean isActive = active.isSelected();

        // For new products only: collect ingredients before saving
        java.util.List<int[]> ingredientRows = new java.util.ArrayList<>(); // [inventoryId, amountUsed]
        if (productId == null) {
            if (!openIngredientEditor(nm, ingredientRows)) return; // user cancelled
        }

        final java.util.List<int[]> finalIngredients = ingredientRows;

        runDb("Saving product...", () -> {
            try (Connection conn = openConn()) {
                conn.setAutoCommit(false);
                if (productId == null) {
                    // Insert product and get its new ID
                    int newProductId;
                    String sql = "INSERT INTO product(name, baseprice, category, is_active) VALUES (?,?,?,?) RETURNING productid";
                    try (PreparedStatement ps = conn.prepareStatement(sql)) {
                        ps.setString(1, nm);
                        ps.setDouble(2, bp);
                        ps.setString(3, cat);
                        ps.setBoolean(4, isActive);
                        try (ResultSet rs = ps.executeQuery()) {
                            rs.next();
                            newProductId = rs.getInt(1);
                        }
                    }
                    // Insert all ingredient rows into productingredient
                    if (!finalIngredients.isEmpty()) {
                        String ingSql = "INSERT INTO productingredient(productid, inventoryid, amountused) VALUES (?,?,?)";
                        try (PreparedStatement ps = conn.prepareStatement(ingSql)) {
                            for (int[] row : finalIngredients) {
                                ps.setInt(1, newProductId);
                                ps.setInt(2, row[0]); // inventoryId
                                ps.setInt(3, row[1]); // amountUsed
                                ps.addBatch();
                            }
                            ps.executeBatch();
                        }
                    }
                } else {
                    String sql = "UPDATE product SET name=?, baseprice=?, category=?, is_active=? WHERE productid=?";
                    try (PreparedStatement ps = conn.prepareStatement(sql)) {
                        ps.setString(1, nm);
                        ps.setDouble(2, bp);
                        ps.setString(3, cat);
                        ps.setBoolean(4, isActive);
                        ps.setInt(5, productId);
                        ps.executeUpdate();
                    }
                }
                conn.commit();
            }
            loadProducts();
            loadInventory();
        });
    }

    /**
     * Shows a dialog for adding ingredient rows to a new product.
     * Populates the provided list with [inventoryId, amountUsed] pairs.
     * Returns true if the user confirmed, false if cancelled.
     */
    private boolean openIngredientEditor(String productName, java.util.List<int[]> result) {
        // Load current inventory items for the dropdown
        java.util.List<String[]> inventoryItems = new java.util.ArrayList<>(); // [id, name]
        try (Connection conn = openConn();
             Statement st = conn.createStatement();
             ResultSet rs = st.executeQuery("SELECT inventoryid, itemname FROM inventory ORDER BY itemname")) {
            while (rs.next()) inventoryItems.add(new String[]{rs.getString(1), rs.getString(2)});
        } catch (Exception ex) {
            toast("Could not load inventory: " + ex.getMessage());
            return false;
        }

        // Table model for ingredients being built
        DefaultTableModel ingModel = new DefaultTableModel(
                new Object[]{"Inventory Item", "Amount Used"}, 0) {
            @Override public boolean isCellEditable(int r, int c) { return true; }
        };
        JTable ingTable = styledTable(ingModel);
        ingTable.setRowHeight(30);

        // Dropdown of inventory items in the "Inventory Item" column
        String[] itemNames = inventoryItems.stream().map(i -> i[1]).toArray(String[]::new);
        JComboBox<String> itemCombo = new JComboBox<>(itemNames);
        ingTable.getColumnModel().getColumn(0).setCellEditor(new DefaultCellEditor(itemCombo));

        // Buttons to add/remove rows and create new inventory items inline
        JButton addRowBtn    = primaryButton("+ Add Ingredient");
        JButton removeRowBtn = primaryButton("- Remove Selected");
        JButton newItemBtn   = primaryButton("+ New Inventory Item");

        addRowBtn.addActionListener(e -> {
            if (itemNames.length == 0) { toast("No inventory items found. Create one first."); return; }
            ingModel.addRow(new Object[]{itemNames[0], "100"});
        });

        removeRowBtn.addActionListener(e -> {
            int row = ingTable.getSelectedRow();
            if (row >= 0) ingModel.removeRow(ingTable.convertRowIndexToModel(row));
        });

        // New inventory item inline — creates it in the DB and refreshes the dropdown
        newItemBtn.addActionListener(e -> {
            JTextField iName    = new JTextField(16);
            JTextField iQty     = new JTextField("0", 8);
            JTextField iUnit    = new JTextField("ml", 6);
            JTextField iReorder = new JTextField("100", 8);
            JPanel iForm = simpleForm(
                    new String[]{"Item Name", "Qty on Hand", "Unit", "Reorder Threshold"},
                    new JComponent[]{iName, iQty, iUnit, iReorder}
            );
            int r = JOptionPane.showConfirmDialog(this, iForm, "New Inventory Item",
                    JOptionPane.OK_CANCEL_OPTION, JOptionPane.PLAIN_MESSAGE);
            if (r != JOptionPane.OK_OPTION) return;
            String iNm = iName.getText().trim();
            if (iNm.isBlank()) { toast("Item name cannot be blank."); return; }
            double iQ, iR;
            try { iQ = Double.parseDouble(iQty.getText().trim()); iR = Double.parseDouble(iReorder.getText().trim()); }
            catch (Exception ex) { toast("Qty and reorder must be numbers."); return; }
            String iU = iUnit.getText().trim();
            // Insert synchronously so it's available immediately in the dropdown
            try (Connection conn = openConn();
                 PreparedStatement ps = conn.prepareStatement(
                         "INSERT INTO inventory(itemname, quantityonhand, unit, reorderthreshold) VALUES (?,?,?,?) RETURNING inventoryid")) {
                ps.setString(1, iNm); ps.setDouble(2, iQ); ps.setString(3, iU); ps.setDouble(4, iR);
                try (ResultSet rs2 = ps.executeQuery()) {
                    rs2.next();
                    int newId = rs2.getInt(1);
                    inventoryItems.add(new String[]{String.valueOf(newId), iNm});
                    itemCombo.addItem(iNm);
                    itemCombo.setSelectedItem(iNm);
                    // Pre-select it in a new row
                    ingModel.addRow(new Object[]{iNm, "100"});
                    toast("Created inventory item: " + iNm);
                }
            } catch (Exception ex) {
                toast("Failed to create item: " + ex.getMessage());
            }
        });

        JPanel btnRow = new JPanel(new FlowLayout(FlowLayout.LEFT, 8, 0));
        btnRow.setOpaque(false);
        btnRow.add(addRowBtn);
        btnRow.add(removeRowBtn);
        btnRow.add(newItemBtn);

        JLabel hint = new JLabel("<html><i>Tip: Amount Used is the quantity deducted per order (e.g. 300 ml of tea base).</i></html>");
        hint.setForeground(new Color(110, 110, 110));
        hint.setFont(hint.getFont().deriveFont(11f));

        JPanel ingPanel = new JPanel(new BorderLayout(8, 8));
        ingPanel.setPreferredSize(new Dimension(560, 340));
        ingPanel.setBorder(new EmptyBorder(8, 8, 8, 8));
        JLabel header = new JLabel("Add ingredients for: " + productName);
        header.setFont(header.getFont().deriveFont(Font.BOLD, 14f));
        ingPanel.add(header, BorderLayout.NORTH);
        ingPanel.add(new JScrollPane(ingTable), BorderLayout.CENTER);
        JPanel south = new JPanel(new BorderLayout(0, 4));
        south.setOpaque(false);
        south.add(btnRow, BorderLayout.NORTH);
        south.add(hint, BorderLayout.SOUTH);
        ingPanel.add(south, BorderLayout.SOUTH);

        int res = JOptionPane.showConfirmDialog(this, ingPanel,
                "Ingredients for: " + productName,
                JOptionPane.OK_CANCEL_OPTION, JOptionPane.PLAIN_MESSAGE);
        if (res != JOptionPane.OK_OPTION) return false;

        // Stop any active cell edit before reading values
        if (ingTable.isEditing()) ingTable.getCellEditor().stopCellEditing();

        // Parse rows into result list
        for (int i = 0; i < ingModel.getRowCount(); i++) {
            String itemNameVal = Objects.toString(ingModel.getValueAt(i, 0), "").trim();
            String amountVal   = Objects.toString(ingModel.getValueAt(i, 1), "0").trim();
            if (itemNameVal.isBlank()) continue;
            // Find matching inventoryId
            int invId = -1;
            for (String[] inv : inventoryItems) {
                if (inv[1].equalsIgnoreCase(itemNameVal)) { invId = Integer.parseInt(inv[0]); break; }
            }
            if (invId == -1) { toast("Unknown inventory item: " + itemNameVal + " — skipping."); continue; }
            int amount = 100;
            try { amount = Integer.parseInt(amountVal); } catch (Exception ignored) {}
            result.add(new int[]{invId, amount});
        }
        return true;
    }

    private void setProductActive(int productId, boolean active) throws Exception {
        try (Connection conn = openConn();
             PreparedStatement ps = conn.prepareStatement("UPDATE product SET is_active=? WHERE productid=?")) {
            ps.setBoolean(1, active);
            ps.setInt(2, productId);
            ps.executeUpdate();
        }
    }

    private void openEmployeeEditor(Integer employeeId, String roleMaybe) {
        JComboBox<String> role = new JComboBox<>(new String[]{"Cashier", "Manager"});
        JTextField first = new JTextField(12);
        JTextField last = new JTextField(12);
        JTextField hire = new JTextField(10);
        JTextField hours = new JTextField(10);
        JCheckBox active = new JCheckBox("Active");

        if (employeeId != null && roleMaybe != null) {
            role.setSelectedItem(roleMaybe);
            role.setEnabled(false);

            int viewRow = employeesTable.getSelectedRow();
            if (viewRow >= 0) {
                int modelRow = employeesTable.convertRowIndexToModel(viewRow);
                first.setText(String.valueOf(employeesModel.getValueAt(modelRow, 1)));
                last.setText(String.valueOf(employeesModel.getValueAt(modelRow, 2)));
                Object d = employeesModel.getValueAt(modelRow, 4);
                hire.setText(d == null ? "" : d.toString());
                Object h = employeesModel.getValueAt(modelRow, 5);
                hours.setText(h == null ? "" : h.toString());
                Object a = employeesModel.getValueAt(modelRow, 6);
                active.setSelected(a instanceof Boolean b ? b : Boolean.parseBoolean(String.valueOf(a)));
            }
        } else {
            active.setSelected(true);
        }

        role.addActionListener(e -> hours.setEnabled("Cashier".equals(role.getSelectedItem())));

        JPanel form = simpleForm(
                new String[]{"Role", "First Name", "Last Name", "Hire Date (YYYY-MM-DD)", "Hours Worked (cashier only)", ""},
                new JComponent[]{role, first, last, hire, hours, active}
        );

        String title = (employeeId == null) ? "Add Employee" : "Edit Employee";
        int res = JOptionPane.showConfirmDialog(this, form, title,
                JOptionPane.OK_CANCEL_OPTION, JOptionPane.PLAIN_MESSAGE);
        if (res != JOptionPane.OK_OPTION) return;

        String r = String.valueOf(role.getSelectedItem());
        String fn = first.getText().trim();
        String ln = last.getText().trim();
        String hd = hire.getText().trim();
        boolean isActive = active.isSelected();

        if (fn.isBlank() || ln.isBlank() || hd.isBlank()) {
            toast("First/Last/Hire Date cannot be blank.");
            return;
        }

        java.sql.Date hireDate;
        try { hireDate = java.sql.Date.valueOf(hd); }
        catch (Exception ex) { toast("Hire date must be in YYYY-MM-DD format."); return; }

        Double hrs = null;
        if ("Cashier".equalsIgnoreCase(r)) {
            String htxt = hours.getText().trim();
            if (!htxt.isBlank()) {
                try { hrs = Double.parseDouble(htxt); }
                catch (Exception ex) { toast("Hours must be a number."); return; }
            } else {
                hrs = 0.0;
            }
        }

        final String fnF = fn;
        final String lnF = ln;
        final java.sql.Date hireDateF = hireDate;
        final Double hrsF = hrs;
        final boolean isActiveF = isActive;
        final String roleF = r;
        final Integer employeeIdF = employeeId;

        runDb("Saving employee...", () -> {
            try (Connection conn = openConn()) {
                if (employeeIdF == null) {
                    if ("Cashier".equalsIgnoreCase(roleF)) {
                        String sql = "INSERT INTO cashier(firstname, lastname, hiredate, hoursworked, is_active) VALUES (?,?,?,?,?)";
                        try (PreparedStatement ps = conn.prepareStatement(sql)) {
                            ps.setString(1, fnF);
                            ps.setString(2, lnF);
                            ps.setDate(3, hireDateF);
                            ps.setDouble(4, hrsF == null ? 0.0 : hrsF);
                            ps.setBoolean(5, isActiveF);
                            ps.executeUpdate();
                        }
                    } else {
                        String sql = "INSERT INTO manager(firstname, lastname, hiredate, is_active) VALUES (?,?,?,?)";
                        try (PreparedStatement ps = conn.prepareStatement(sql)) {
                            ps.setString(1, fnF);
                            ps.setString(2, lnF);
                            ps.setDate(3, hireDateF);
                            ps.setBoolean(4, isActiveF);
                            ps.executeUpdate();
                        }
                    }
                } else {
                    if ("Cashier".equalsIgnoreCase(roleF)) {
                        String sql = "UPDATE cashier SET firstname=?, lastname=?, hiredate=?, hoursworked=?, is_active=? WHERE cashierid=?";
                        try (PreparedStatement ps = conn.prepareStatement(sql)) {
                            ps.setString(1, fnF);
                            ps.setString(2, lnF);
                            ps.setDate(3, hireDateF);
                            ps.setDouble(4, hrsF == null ? 0.0 : hrsF);
                            ps.setBoolean(5, isActiveF);
                            ps.setInt(6, employeeIdF);
                            ps.executeUpdate();
                        }
                    } else {
                        String sql = "UPDATE manager SET firstname=?, lastname=?, hiredate=?, is_active=? WHERE managerid=?";
                        try (PreparedStatement ps = conn.prepareStatement(sql)) {
                            ps.setString(1, fnF);
                            ps.setString(2, lnF);
                            ps.setDate(3, hireDateF);
                            ps.setBoolean(4, isActiveF);
                            ps.setInt(5, employeeIdF);
                            ps.executeUpdate();
                        }
                    }
                }
            }
            loadEmployees();
        });
    }

    private void setEmployeeActive(int id, String role, boolean active) throws Exception {
        String table = "Cashier".equalsIgnoreCase(role) ? "cashier" : "manager";
        String idCol = "Cashier".equalsIgnoreCase(role) ? "cashierid" : "managerid";
        try (Connection conn = openConn();
             PreparedStatement ps = conn.prepareStatement("UPDATE " + table + " SET is_active=? WHERE " + idCol + "=?")) {
            ps.setBoolean(1, active);
            ps.setInt(2, id);
            ps.executeUpdate();
        }
    }

    // ===================== TABLE / SEARCH =====================

    private JTable styledTable(DefaultTableModel model) {
        JTable t = new JTable(model);
        t.setFillsViewportHeight(true);
        t.setRowHeight(30);
        t.setFont(new Font("SansSerif", Font.PLAIN, 13));
        t.setGridColor(new Color(235, 235, 235));
        t.setShowVerticalLines(false);
        t.setSelectionBackground(new Color(225, 205, 210));
        t.setSelectionForeground(new Color(30, 30, 30));

        JTableHeader th = t.getTableHeader();
        th.setFont(new Font("SansSerif", Font.BOLD, 12));
        th.setReorderingAllowed(false);
        th.setPreferredSize(new Dimension(th.getPreferredSize().width, 34));

        DefaultTableCellRenderer r = new DefaultTableCellRenderer() {
            @Override public Component getTableCellRendererComponent(JTable table, Object value,
                                                                     boolean isSelected, boolean hasFocus,
                                                                     int row, int column) {
                Component c = super.getTableCellRendererComponent(table, value, isSelected, hasFocus, row, column);
                if (!isSelected) {
                    c.setBackground(row % 2 == 0 ? Color.WHITE : new Color(248, 248, 248));
                }
                return c;
            }
        };
        for (int i = 0; i < t.getColumnCount(); i++) t.getColumnModel().getColumn(i).setCellRenderer(r);

        TableRowSorter<DefaultTableModel> sorter = new TableRowSorter<>(model);
        t.setRowSorter(sorter);

        return t;
    }

    private void applySearch() {
        if (searchField == null) return;
        String q = searchField.getText();
        JTable active = getActiveTable();
        if (active == null) return;

        @SuppressWarnings("unchecked")
        TableRowSorter<DefaultTableModel> sorter = (TableRowSorter<DefaultTableModel>) active.getRowSorter();

        if (q == null || q.isBlank()) sorter.setRowFilter(null);
        else sorter.setRowFilter(RowFilter.regexFilter("(?i)" + PatternUtil.escapeRegex(q)));
    }

    private JTable getActiveTable() {
        for (Component comp : contentPanel.getComponents()) {
            if (comp.isVisible()) {
                JTable found = findTable(comp);
                if (found != null) return found;
            }
        }
        return null;
    }

    private JTable findTable(Component root) {
        if (root instanceof JTable jt) return jt;
        if (root instanceof Container c) {
            for (Component child : c.getComponents()) {
                JTable r = findTable(child);
                if (r != null) return r;
            }
        }
        return null;
    }

    private void refreshCurrentPage() {
        ButtonModel sel = navGroup.getSelection();
        if (sel == null) return;

        for (Component c : navButtons.getComponents()) {
            if (c instanceof AbstractButton b && b.getModel() == sel) {
                String label = b.getText().toLowerCase();
                if (label.contains("dashboard")) runDb("Loading dashboard...", this::loadDashboardQuickStats);
                else if (label.contains("inventory")) runDb("Loading inventory...", this::loadInventory);
                else if (label.contains("employees")) runDb("Loading employees...", this::loadEmployees);
                else if (label.contains("products")) runDb("Loading products...", this::loadProducts);
                else if (label.contains("sales")) runDb("Loading sales...", this::loadSales);
                else if (label.contains("charts")) runDb("Loading charts...", this::loadCharts);
                return;
            }
        }
    }

    private Integer getSelectedInt(JTable table, int modelCol) {
        int viewRow = table.getSelectedRow();
        if (viewRow < 0) return null;
        int modelRow = table.convertRowIndexToModel(viewRow);
        Object v = table.getModel().getValueAt(modelRow, modelCol);
        if (v == null) return null;
        if (v instanceof Number n) return n.intValue();
        try { return Integer.parseInt(v.toString()); } catch (Exception e) { return null; }
    }

    private String getSelectedString(JTable table, int modelCol) {
        int viewRow = table.getSelectedRow();
        if (viewRow < 0) return null;
        int modelRow = table.convertRowIndexToModel(viewRow);
        Object v = table.getModel().getValueAt(modelRow, modelCol);
        return v == null ? null : v.toString();
    }

    private Boolean getSelectedBoolean(JTable table, int modelCol) {
        int viewRow = table.getSelectedRow();
        if (viewRow < 0) return null;
        int modelRow = table.convertRowIndexToModel(viewRow);
        Object v = table.getModel().getValueAt(modelRow, modelCol);
        if (v instanceof Boolean b) return b;
        if (v == null) return null;
        return Boolean.parseBoolean(v.toString());
    }

    private JPanel simpleForm(String[] labels, JComponent[] fields) {
        JPanel p = new JPanel(new GridBagLayout());
        GridBagConstraints gc = new GridBagConstraints();
        gc.insets = new Insets(6, 6, 6, 6);
        gc.anchor = GridBagConstraints.WEST;
        gc.fill = GridBagConstraints.HORIZONTAL;
        gc.gridx = 0;
        gc.gridy = 0;

        for (int i = 0; i < labels.length; i++) {
            if (!labels[i].isBlank()) {
                gc.gridx = 0;
                p.add(new JLabel(labels[i] + ":"), gc);
                gc.gridx = 1;
                p.add(fields[i], gc);
            } else {
                gc.gridx = 1;
                p.add(fields[i], gc);
            }
            gc.gridy++;
        }
        return p;
    }

    // ===================== BUTTONS =====================

    private JButton primaryButton(String text) {
        JButton b = new JButton(text);
        b.setFocusPainted(false);
        b.setFont(new Font("SansSerif", Font.BOLD, 12));
        b.setForeground(Color.WHITE);
        b.setBackground((Color) UIManager.get("App.accent"));
        b.setBorder(new EmptyBorder(10, 14, 10, 14));
        b.setCursor(Cursor.getPredefinedCursor(Cursor.HAND_CURSOR));
        b.addMouseListener(new MouseAdapter() {
            @Override public void mouseEntered(MouseEvent e) { animateButtonBg(b, ((Color) UIManager.get("App.accent2"))); }
            @Override public void mouseExited(MouseEvent e) { animateButtonBg(b, ((Color) UIManager.get("App.accent"))); }
        });
        return b;
    }

    private void animateButtonBg(JButton button, Color target) {
        Color start = button.getBackground();
        if (start == null) start = target;
        if (start.equals(target)) {
            button.setBackground(target);
            return;
        }

        final int steps = 10;
        final int delayMs = 15;
        final int sr = start.getRed(), sg = start.getGreen(), sb = start.getBlue();
        final int tr = target.getRed(), tg = target.getGreen(), tb = target.getBlue();

        Timer timer = new Timer(delayMs, null);
        timer.addActionListener(new ActionListener() {
            int i = 0;
            @Override public void actionPerformed(ActionEvent e) {
                i++;
                float t = i / (float) steps;
                int r = (int) (sr + (tr - sr) * t);
                int g = (int) (sg + (tg - sg) * t);
                int b = (int) (sb + (tb - sb) * t);
                button.setBackground(new Color(r, g, b));
                if (i >= steps) timer.stop();
            }
        });
        timer.setRepeats(true);
        timer.start();
    }

    // ===================== DB =====================

    private Connection openConn() throws SQLException {
        Objects.requireNonNull(CREDS, "Missing credentials");
        return DriverManager.getConnection(CREDS.url(), CREDS.user(), CREDS.pass());
    }

    @FunctionalInterface
    private interface DbWork { void run() throws Exception; }

    private void runDb(String busyMsg, DbWork work) {
        statusLabel.setText(busyMsg);
        busyBar.setVisible(true);
        loading.showLoading(busyMsg);

        SwingWorker<Void, Void> sw = new SwingWorker<>() {
            @Override protected Void doInBackground() {
                try {
                    work.run();
                } catch (Exception ex) {
                    SwingUtilities.invokeLater(() -> toast("DB error: " + ex.getMessage()));
                }
                return null;
            }

            @Override protected void done() {
                loading.hideLoading();
                busyBar.setVisible(false);
                statusLabel.setText("Ready - Ctrl+R refresh - Ctrl+F search");
            }
        };
        sw.execute();
    }

    private void toast(String msg) {
        JOptionPane.showMessageDialog(this, msg, "Team 25 Manager", JOptionPane.INFORMATION_MESSAGE);
    }

    private record DbCreds(String url, String user, String pass) {}

    // ===================== LOADING GLASS =====================

    private static class LoadingGlassPane extends JComponent {
        private final JLabel msg = new JLabel("Loading...");
        private final JProgressBar bar = new JProgressBar();

        public LoadingGlassPane() {
            setLayout(new GridBagLayout());
            setOpaque(false);

            JPanel card = new JPanel(new BorderLayout(10, 10));
            card.setBorder(new EmptyBorder(14, 16, 14, 16));
            card.setBackground(new Color(255, 255, 255, 245));

            msg.setFont(new Font("SansSerif", Font.BOLD, 14));
            msg.setForeground(new Color(20, 20, 20));

            bar.setIndeterminate(true);
            bar.setPreferredSize(new Dimension(220, 10));

            card.add(msg, BorderLayout.NORTH);
            card.add(bar, BorderLayout.SOUTH);

            add(card);
        }

        public void showLoading(String text) {
            msg.setText(text);
            setVisible(true);
            repaint();
        }

        public void hideLoading() {
            setVisible(false);
        }

        @Override protected void paintComponent(Graphics g) {
            Graphics2D g2 = (Graphics2D) g.create();
            g2.setColor(new Color(0, 0, 0, 110));
            g2.fillRect(0, 0, getWidth(), getHeight());
            g2.dispose();
        }
    }



    // ===================== CHARTS PAGE =====================








    // ===================== CHARTS PAGE =====================

private JPanel buildChartsPage() {
    JPanel p = new JPanel(new BorderLayout(10, 10));
    p.setOpaque(false);

    JLabel h = new JLabel("Product Usage (Inventory Used)");
    h.setFont(new Font("SansSerif", Font.BOLD, 20));

    // Default window: last 30 days
    java.time.LocalDate end = java.time.LocalDate.now();
    java.time.LocalDate start = end.minusDays(30);

    startDateField = new JTextField(start.toString(), 10); // YYYY-MM-DD
    endDateField   = new JTextField(end.toString(), 10);   // YYYY-MM-DD

    excludeZeroBox = new JCheckBox("Exclude 0-usage items");
    excludeZeroBox.setSelected(true);
    excludeZeroBox.setOpaque(false);

    JButton reload = primaryButton("Reload Chart");
    reload.addActionListener(e -> runDb("Loading product usage...", this::loadCharts));

    JPanel controls = new JPanel(new FlowLayout(FlowLayout.RIGHT, 10, 0));
    controls.setOpaque(false);
    controls.add(new JLabel("Start (YYYY-MM-DD):"));
    controls.add(startDateField);
    controls.add(new JLabel("End (YYYY-MM-DD):"));
    controls.add(endDateField);
    controls.add(excludeZeroBox);
    controls.add(reload);

    JPanel top = new JPanel(new BorderLayout());
    top.setOpaque(false);
    top.add(h, BorderLayout.WEST);
    top.add(controls, BorderLayout.EAST);

    JFreeChart topChart = ChartFactory.createBarChart(
            "Inventory Used (Top 10)", "Inventory Item", "Amount Used",
            topDataset, PlotOrientation.VERTICAL, false, true, false
    );

    JFreeChart bottomChart = ChartFactory.createBarChart(
            "Inventory Used (Bottom 10)", "Inventory Item", "Amount Used",
            bottomDataset, PlotOrientation.VERTICAL, false, true, false
    );

    styleChart(topChart);
    styleChart(bottomChart);

    topChartPanel = new ChartPanel(topChart);
    bottomChartPanel = new ChartPanel(bottomChart);

    JPanel charts = new JPanel(new GridLayout(2, 1, 12, 12));
    charts.setOpaque(false);
    charts.add(wrapCard(topChartPanel));
    charts.add(wrapCard(bottomChartPanel));

    p.add(top, BorderLayout.NORTH);
    p.add(charts, BorderLayout.CENTER);

    return p;
}

private void styleChart(JFreeChart chart) {
    chart.setBackgroundPaint((Color) UIManager.get("App.card"));
    CategoryPlot plot = chart.getCategoryPlot();
    plot.setBackgroundPaint(Color.WHITE);
    plot.setRangeGridlinePaint(new Color(230, 230, 230));
}

private void loadCharts() throws Exception {
    topDataset.clear();
    bottomDataset.clear();

    // Parse dates (inclusive start, inclusive end)
    java.time.LocalDate start;
    java.time.LocalDate end;
    try {
        start = java.time.LocalDate.parse(startDateField.getText().trim());
        end   = java.time.LocalDate.parse(endDateField.getText().trim());
    } catch (Exception ex) {
        throw new IllegalArgumentException("Dates must be YYYY-MM-DD (example: 2026-03-03)");
    }

    if (end.isBefore(start)) {
        throw new IllegalArgumentException("End date must be >= start date.");
    }

    // Use end+1 day as exclusive upper bound so the end date is included
    Timestamp startTs = Timestamp.valueOf(start.atStartOfDay());
    Timestamp endExclusiveTs = Timestamp.valueOf(end.plusDays(1).atStartOfDay());

    boolean excludeZero = excludeZeroBox.isSelected();
    String having = excludeZero ? "HAVING SUM(ti.quantity * pi.amountused) > 0 " : "";

    // Inventory used = SUM( quantity sold * ingredient amountused per product )
    String baseSql =
            "SELECT i.inventoryid, i.itemname, i.unit, " +
            "       SUM(ti.quantity * pi.amountused) AS used_amount " +
            "FROM transactions t " +
            "JOIN transactionitem ti ON ti.transactionid = t.transactionid " +
            "JOIN productingredient pi ON pi.productid = ti.productid " +
            "JOIN inventory i ON i.inventoryid = pi.inventoryid " +
            "WHERE t.transactiontime >= ? AND t.transactiontime < ? " +
            "GROUP BY i.inventoryid, i.itemname, i.unit " +
            having;

    String topSql = baseSql + "ORDER BY used_amount DESC NULLS LAST LIMIT 10";
    String bottomSql = baseSql + "ORDER BY used_amount ASC NULLS LAST LIMIT 10";

    // TOP 10 USED 
    try (Connection conn = openConn();
         PreparedStatement ps = conn.prepareStatement(topSql)) {

        ps.setTimestamp(1, startTs);
        ps.setTimestamp(2, endExclusiveTs);

        try (ResultSet rs = ps.executeQuery()) {
            while (rs.next()) {
                int invId = rs.getInt("inventoryid");
                String item = rs.getString("itemname");
                String unit = rs.getString("unit");

                String label = "#" + invId + " - " + item + " (" + unit + ")";

                Number used = (Number) rs.getObject("used_amount"); // numeric -> BigDecimal but still Number
                if (used != null) {
                    topDataset.addValue(used.doubleValue(), "Used", label);
                }
            }
        }
    }

    //  BOTTOM 10 USED 
    try (Connection conn = openConn();
         PreparedStatement ps = conn.prepareStatement(bottomSql)) {

        ps.setTimestamp(1, startTs);
        ps.setTimestamp(2, endExclusiveTs);

        try (ResultSet rs = ps.executeQuery()) {
            while (rs.next()) {
                int invId = rs.getInt("inventoryid");
                String item = rs.getString("itemname");
                String unit = rs.getString("unit");

                String label = "#" + invId + " - " + item + " (" + unit + ")";

                Number used = (Number) rs.getObject("used_amount");
                if (used != null) {
                    bottomDataset.addValue(used.doubleValue(), "Used", label);
                }
            }
        }
    }

    // Update axis labels
    topChartPanel.getChart().getCategoryPlot().getRangeAxis().setLabel("Amount Used");
    bottomChartPanel.getChart().getCategoryPlot().getRangeAxis().setLabel("Amount Used");
}










    // ===================== MISC =====================

    private static class PatternUtil {
        static String escapeRegex(String s) {
            StringBuilder out = new StringBuilder();
            for (char ch : s.toCharArray()) {
                if ("\\.^$|?*+()[]{}".indexOf(ch) >= 0) out.append('\\');
                out.append(ch);
            }
            return out.toString();
        }
    }
}