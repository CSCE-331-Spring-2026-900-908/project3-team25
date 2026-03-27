import com.formdev.flatlaf.FlatLightLaf;

import javax.swing.*;
import javax.swing.border.EmptyBorder;
import java.awt.*;
import java.io.FileInputStream;
import java.io.InputStream;
import java.sql.Connection;
import java.sql.DriverManager;
import java.util.Properties;

/**
 * Launches the Team 25 point-of-sale application.
 * Handles database credential loading, connection testing,
 * employee login, and routing to the cashier or manager interface.
 */
public class LauncherApp {

    /**
     * Creates a new launcher application instance.
     */
    public LauncherApp() {
    }

    /**
     * Stores database connection credentials used by the application.
     *
     * @param url JDBC connection URL
     * @param user database username
     * @param pass database password
     */
    public record DbCreds(String url, String user, String pass) {}

    private static final String ENV_DB_URL  = "TEAM25_DB_URL";
    private static final String ENV_DB_USER = "TEAM25_DB_USER";
    private static final String ENV_DB_PASS = "TEAM25_DB_PASS";

    private static final String PROPS_FILE = "db.properties";

    /**
     * Closes the current application window and returns the user
     * to the employee login flow.
     *
     * @param currentWindow currently open application window
     * @param creds database credentials used to reconnect
     */
    public static void relaunchToEmployeeLogin(JFrame currentWindow, DbCreds creds) {
    SwingUtilities.invokeLater(() -> {
        if (currentWindow != null) {
            currentWindow.dispose();
        }

        UserSession session = employeeLoginDialog(creds);
        if (session == null) return;

        launchRoleApp(creds, session);
        
    });
}

    /**
     * Application entry point.
     *
     * @param args command-line arguments
     */
    public static void main(String[] args) {
        SwingUtilities.invokeLater(() -> {
            FlatLightLaf.setup();

            DbCreds creds = readDbCreds();
            if (creds == null) return;

            if (!testDb(creds)) return;

            UserSession session = employeeLoginDialog(creds);
            if (session == null) return;

            launchRoleApp(creds, session);
        });
    }

    // Helper
    private static void launchRoleApp(DbCreds creds, UserSession session) {
        if ("Manager".equalsIgnoreCase(session.role())) {
            new ManagerApp(creds, session).setVisible(true);
        } else {
            new CashierApp(creds, session).setVisible(true);
        }
    }

    private static DbCreds readDbCreds() {
        DbCreds fromFile = readDbCredsFromProperties();
        if (fromFile != null) return fromFile;
        return readDbCredsFromEnv();
    }

    private static DbCreds readDbCredsFromProperties() {
        Properties props = new Properties();
        try (InputStream in = new FileInputStream(PROPS_FILE)) {
            props.load(in);
        } catch (Exception e) {
            return null;
        }

        String url  = safeTrim(props.getProperty("db.url"));
        String user = safeTrim(props.getProperty("db.user"));
        String pass = safeTrim(props.getProperty("db.pass"));

        if (url.isBlank() || user.isBlank() || pass.isBlank()) return null;
        return new DbCreds(url, user, pass);
    }

    private static DbCreds readDbCredsFromEnv() {
        String url  = safeTrim(System.getenv(ENV_DB_URL));
        String user = safeTrim(System.getenv(ENV_DB_USER));
        String pass = safeTrim(System.getenv(ENV_DB_PASS));

        if (url.isBlank() || user.isBlank() || pass.isBlank()) {
            JOptionPane.showMessageDialog(
                    null,
                    "Missing DB credentials.\n\n" +
                            "Preferred: create a '" + PROPS_FILE + "' file in the project root:\n" +
                            "  db.url=jdbc:postgresql://csce-315-db.engr.tamu.edu:5432/team_25_db\n" +
                            "  db.user=...\n" +
                            "  db.pass=...\n\n" +
                            "Alternative: set environment variables:\n" +
                            "  " + ENV_DB_URL + "\n" +
                            "  " + ENV_DB_USER + "\n" +
                            "  " + ENV_DB_PASS,
                    "Configuration Error",
                    JOptionPane.ERROR_MESSAGE
            );
            return null;
        }

        return new DbCreds(url, user, pass);
    }

    private static String safeTrim(String s) {
        return (s == null) ? "" : s.trim();
    }

    private static boolean testDb(DbCreds creds) {
        try (Connection c = DriverManager.getConnection(creds.url(), creds.user(), creds.pass())) {
            return true;
        } catch (Exception ex) {
            JOptionPane.showMessageDialog(
                    null,
                    "Database connection failed.\n\n" + ex.getMessage(),
                    "DB Error",
                    JOptionPane.ERROR_MESSAGE
            );
            return false;
        }
    }

    private static UserSession employeeLoginDialog(DbCreds creds) {
        JComboBox<String> roleBox = new JComboBox<>(new String[]{"Cashier", "Manager"});
        JTextField idField = new JTextField(10);
        JPasswordField pinField = new JPasswordField(10);

        JPanel form = new JPanel(new GridBagLayout());
        form.setBorder(new EmptyBorder(8, 8, 8, 8));
        GridBagConstraints gc = new GridBagConstraints();
        gc.insets = new Insets(6, 6, 6, 6);
        gc.anchor = GridBagConstraints.WEST;

        gc.gridx = 0; gc.gridy = 0; form.add(new JLabel("Role:"), gc);
        gc.gridx = 1; form.add(roleBox, gc);

        gc.gridx = 0; gc.gridy = 1; form.add(new JLabel("Employee ID:"), gc);
        gc.gridx = 1; form.add(idField, gc);

        gc.gridx = 0; gc.gridy = 2; form.add(new JLabel("PIN:"), gc);
        gc.gridx = 1; form.add(pinField, gc);

        while (true) {
            int res = JOptionPane.showConfirmDialog(
                    null, form, "Employee Login",
                    JOptionPane.OK_CANCEL_OPTION, JOptionPane.PLAIN_MESSAGE
            );
            if (res != JOptionPane.OK_OPTION) return null;

            String role = String.valueOf(roleBox.getSelectedItem());

            int empId;
            try {
                empId = Integer.parseInt(idField.getText().trim());
            } catch (Exception e) {
                JOptionPane.showMessageDialog(null, "Employee ID must be a number.", "Error", JOptionPane.ERROR_MESSAGE);
                continue;
            }

            String pin = new String(pinField.getPassword()).trim();
            if (pin.isBlank()) {
                JOptionPane.showMessageDialog(null, "PIN cannot be blank.", "Error", JOptionPane.ERROR_MESSAGE);
                continue;
            }

            try (Connection conn = DriverManager.getConnection(creds.url(), creds.user(), creds.pass())) {
                UserSession session = AuthService.loginEmployee(conn, role, empId, pin);
                if (session == null) {
                    JOptionPane.showMessageDialog(
                            null,
                            "Login failed. Check Role/ID/PIN and make sure the employee is active.",
                            "Login Error",
                            JOptionPane.ERROR_MESSAGE
                    );
                    continue;
                }
                return session;
            } catch (Exception ex) {
                JOptionPane.showMessageDialog(null, "DB error:\n" + ex.getMessage(), "Error", JOptionPane.ERROR_MESSAGE);
                return null;
            }
        }
    }
}