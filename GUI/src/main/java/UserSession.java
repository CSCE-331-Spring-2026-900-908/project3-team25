import java.io.Serializable;

/**
 * Represents an authenticated employee session.
 * Stores basic identity and role information for the active user.
 *
 * @param role employee role, such as Cashier or Manager
 * @param id employee identifier from the corresponding database table
 * @param firstName employee first name
 * @param lastName employee last name
 */
public record UserSession(
        String role,     // "Cashier" or "Manager"
        int id,          // cashierid or managerid
        String firstName,
        String lastName
) implements Serializable {

    /**
     * Returns the employee's full display name.
     *
     * @return full name of the active employee
     */
    public String fullName() {
        return firstName + " " + lastName;
    }

    /**
     * Checks whether the active employee is a manager.
     *
     * @return true if the employee role is manager
     */
    public boolean isManager() {
        return "Manager".equalsIgnoreCase(role);
    }

    /**
     * Checks whether the active employee is a cashier.
     *
     * @return true if the employee role is cashier
     */
    public boolean isCashier() {
        return "Cashier".equalsIgnoreCase(role);
    }
}