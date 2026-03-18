import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;

/**
 * Provides authentication services for cashier and manager employees.
 * Validates employee IDs and optional PIN values against the database
 * and creates a user session for successful logins.
 */
public class AuthService {

    /**
     * Authenticates an employee without requiring a PIN.
     *
     * @param conn active database connection
     * @param role employee role to authenticate
     * @param employeeId employee ID number
     * @return authenticated user session, or null if login fails
     * @throws Exception if a database error occurs
     */
    public static UserSession loginEmployee(Connection conn, String role, int employeeId) throws Exception {
        return loginEmployee(conn, role, employeeId, null);
    }

    /**
     * Authenticates an employee using role, employee ID, and optional PIN.
     *
     * @param conn active database connection
     * @param role employee role to authenticate
     * @param employeeId employee ID number
     * @param pin entered PIN value
     * @return authenticated user session, or null if login fails
     * @throws Exception if a database error occurs
     */
    public static UserSession loginEmployee(Connection conn, String role, int employeeId, String pin) throws Exception {
        if ("Cashier".equalsIgnoreCase(role)) {
            String sql = "SELECT cashierid, firstname, lastname, pin FROM cashier WHERE cashierid=? AND is_active=true";
            try (PreparedStatement ps = conn.prepareStatement(sql)) {
                ps.setInt(1, employeeId);
                try (ResultSet rs = ps.executeQuery()) {
                    if (!rs.next()) return null;

                    String dbPin = rs.getString("pin");
                    if (dbPin != null) {
                        String provided = (pin == null) ? "" : pin.trim();
                        if (!dbPin.equals(provided)) return null;
                    }

                    return new UserSession("Cashier", rs.getInt("cashierid"), rs.getString("firstname"), rs.getString("lastname"));
                }
            }

        } else if ("Manager".equalsIgnoreCase(role)) {
            String sql = "SELECT managerid, firstname, lastname, pin FROM manager WHERE managerid=? AND is_active=true";
            try (PreparedStatement ps = conn.prepareStatement(sql)) {
                ps.setInt(1, employeeId);
                try (ResultSet rs = ps.executeQuery()) {
                    if (!rs.next()) return null;

                    String dbPin = rs.getString("pin");
                    if (dbPin != null) {
                        String provided = (pin == null) ? "" : pin.trim();
                        if (!dbPin.equals(provided)) return null;
                    }

                    return new UserSession("Manager", rs.getInt("managerid"), rs.getString("firstname"), rs.getString("lastname"));
                }
            }

        } else {
            throw new IllegalArgumentException("Unknown role: " + role);
        }
    }
}