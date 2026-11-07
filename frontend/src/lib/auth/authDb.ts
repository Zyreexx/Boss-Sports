
/**
 * =========================================================================
 * AUTHENTICATION & ROLE GOVERNANCE SERVICE
 * Evaluates credentials and assigns user role: OWNER, EMPLOYEE, or CUSTOMER
 * =========================================================================
 */

import fs from "fs";
import path from "path";

export type UserRole = "OWNER" | "EMPLOYEE" | "CUSTOMER";

export interface UserAccount {
  id: string;
  email: string;
  phone: string;
  name: string;
  role: UserRole;
  passwordHash: string; // Plain/Demo hashed for development
  avatar?: string;
  createdAt: string;
}

const AUTH_DB_DIR = path.join(process.cwd(), "data");
const AUTH_DB_FILE = path.join(AUTH_DB_DIR, "users_auth.json");

if (!fs.existsSync(AUTH_DB_DIR)) {
  fs.mkdirSync(AUTH_DB_DIR, { recursive: true });
}

// Initial Users List (empty in production; accounts register via Google or Signup)
const initialUsers: UserAccount[] = [];

class AuthDatabaseService {
  private loadUsers(): UserAccount[] {
    try {
      if (!fs.existsSync(AUTH_DB_FILE)) {
        this.saveUsers(initialUsers);
        return initialUsers;
      }
      const raw = fs.readFileSync(AUTH_DB_FILE, "utf-8");
      return JSON.parse(raw);
    } catch (e) {
      return initialUsers;
    }
  }

  private saveUsers(users: UserAccount[]) {
    try {
      fs.writeFileSync(AUTH_DB_FILE, JSON.stringify(users, null, 2), "utf-8");
    } catch (e) {
      console.error("Failed to save auth db", e);
    }
  }

  public authenticate(identifier: string, password: string): {
    success: boolean;
    user?: Omit<UserAccount, "passwordHash">;
    redirectUrl?: string;
    token?: string;
    error?: string;
  } {
    const users = this.loadUsers();
    const cleanId = identifier.trim().toLowerCase();
    const cleanPhone = identifier.replace(/\D/g, "");

    const user = users.find(
      (u) =>
        u.email.toLowerCase() === cleanId ||
        (cleanPhone.length >= 10 && u.phone.includes(cleanPhone))
    );

    if (!user) {
      return { success: false, error: "No account found matching this email or phone number." };
    }

    if (user.passwordHash !== password) {
      return { success: false, error: "Invalid password. Please check your credentials." };
    }

    // Role-based target destination
    let redirectUrl = "/";
    if (user.role === "OWNER") {
      redirectUrl = "/admin";
    } else if (user.role === "EMPLOYEE") {
      redirectUrl = "/staff";
    } else {
      redirectUrl = "/";
    }

    // Generate lightweight deterministic session token
    const token = `boss_tk_${user.role.toLowerCase()}_${user.id}_${Date.now()}`;

    const { passwordHash, ...safeUser } = user;

    return {
      success: true,
      user: safeUser,
      redirectUrl,
      token,
    };
  }

  public register(params: {
    name: string;
    email: string;
    phone: string;
    password: string;
    role?: UserRole;
  }): { success: boolean; user?: Omit<UserAccount, "passwordHash">; token?: string; error?: string } {
    const users = this.loadUsers();
    const existing = users.find(
      (u) =>
        u.email.toLowerCase() === params.email.toLowerCase() ||
        u.phone.replace(/\D/g, "") === params.phone.replace(/\D/g, "")
    );

    if (existing) {
      return { success: false, error: "An account with this email or phone already exists." };
    }

    const newUser: UserAccount = {
      id: `usr-${Date.now()}`,
      name: params.name,
      email: params.email,
      phone: params.phone,
      passwordHash: params.password,
      role: params.role || "CUSTOMER",
      createdAt: new Date().toISOString(),
    };

    users.push(newUser);
    this.saveUsers(users);

    const token = `boss_tk_${newUser.role.toLowerCase()}_${newUser.id}_${Date.now()}`;
    const { passwordHash, ...safeUser } = newUser;

    return {
      success: true,
      user: safeUser,
      token,
    };
  }

  public getUserById(userId: string): Omit<UserAccount, "passwordHash"> | null {
    const users = this.loadUsers();
    const user = users.find((u) => u.id === userId);
    if (!user) return null;
    const { passwordHash, ...safe } = user;
    return safe;
  }

  public findOrCreateGoogleUser(params: {
    email: string;
    name: string;
    avatar?: string;
    googleId?: string;
  }): {
    success: boolean;
    user: Omit<UserAccount, "passwordHash">;
    redirectUrl: string;
    token: string;
  } {
    const users = this.loadUsers();
    const cleanEmail = params.email.trim().toLowerCase();

    let user = users.find((u) => u.email.toLowerCase() === cleanEmail);

    if (user) {
      if (params.avatar && !user.avatar) {
        user.avatar = params.avatar;
      }
      if (params.name && !user.name) {
        user.name = params.name;
      }
      this.saveUsers(users);
    } else {
      const ownerEmails = (process.env.OWNER_EMAILS || process.env.OWNER_EMAIL || "")
        .toLowerCase()
        .split(",")
        .map((e) => e.trim())
        .filter(Boolean);

      const staffEmails = (process.env.STAFF_EMAILS || "")
        .toLowerCase()
        .split(",")
        .map((e) => e.trim())
        .filter(Boolean);

      let role: UserRole = "CUSTOMER";
      if (ownerEmails.includes(cleanEmail)) {
        role = "OWNER";
      } else if (staffEmails.includes(cleanEmail)) {
        role = "EMPLOYEE";
      }

      user = {
        id: `usr-google-${Date.now()}`,
        name: params.name || cleanEmail.split("@")[0],
        email: cleanEmail,
        phone: "",
        avatar: params.avatar,
        role,
        passwordHash: `google_oauth_${Date.now()}`,
        createdAt: new Date().toISOString(),
      };

      users.push(user);
      this.saveUsers(users);
    }

    let redirectUrl = "/";
    if (user.role === "OWNER") {
      redirectUrl = "/admin";
    } else if (user.role === "EMPLOYEE") {
      redirectUrl = "/staff";
    } else {
      redirectUrl = "/profile";
    }

    const token = `boss_tk_${user.role.toLowerCase()}_${user.id}_${Date.now()}`;
    const { passwordHash, ...safeUser } = user;

    return {
      success: true,
      user: safeUser,
      redirectUrl,
      token,
    };
  }
}

export const authDb = new AuthDatabaseService();
export default authDb;

