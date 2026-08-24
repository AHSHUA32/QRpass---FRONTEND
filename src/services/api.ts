const API_URL = "http://localhost:8000/api";

export async function login(
  username: string,
  password: string
) {
  const response = await fetch(`${API_URL}/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      username,
      password,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Login failed.");
  }

  return data;
}

export async function register(
  name: string,
  email: string,
  username: string,
  password: string,
  role: string
) {
  const response = await fetch(`${API_URL}/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      name,
      email,
      username,
      password,
      role,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    if (data.errors) {
      const firstError = Object.values(data.errors)[0] as string[];
      throw new Error(firstError[0]);
    }

    throw new Error(data.message || "Registration failed.");
  }

  return data;
}

export async function getItems() {
  const token = localStorage.getItem("token");

  const response = await fetch(`${API_URL}/items`, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Failed to load items.");
  }

  return data;
}

export async function createItem(item: {
  item_name: string;
  brand_model: string;
  serial_number: string;
  color: string;
  item_type: string;
  purpose: string;
}) {
  const token = localStorage.getItem("token");

  const response = await fetch(`${API_URL}/items`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(item),
  });

  const data = await response.json();

  if (!response.ok) {
    if (data.errors) {
      const firstError = Object.values(data.errors)[0] as string[];
      throw new Error(firstError[0]);
    }

    throw new Error(data.message || "Item registration failed.");
  }

  return data;
}
export async function getPendingItems() {
  const token = localStorage.getItem("token");

  const response = await fetch(`${API_URL}/items/pending`, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Failed to load pending items.");
  }

  return data;
}

export async function approveItem(id: number) {
  const token = localStorage.getItem("token");

  const response = await fetch(`${API_URL}/items/${id}/approve`, {
    method: "PUT",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Failed to approve item.");
  }

  return data;
}

export async function verifyItem(code: string) {
  const token = localStorage.getItem("token");

  const response = await fetch(`${API_URL}/items/verify`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      code,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Item verification failed.");
  }

  return data;
}

export async function createScanLog(
  registeredItemId: number,
  gate: string,
  direction: "IN" | "OUT"
) {
  const token = localStorage.getItem("token");

  const response = await fetch(`${API_URL}/scan-logs`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      registered_item_id: registeredItemId,
      gate,
      direction,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Failed to save scan log.");
  }

  return data;
}

export async function getScanLogs() {
  const token = localStorage.getItem("token");

  const response = await fetch(`${API_URL}/scan-logs`, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Failed to load scan logs.");
  }

  return data;
}
export async function getAllItems() {
  const token = localStorage.getItem("token");

  const response = await fetch(`${API_URL}/items/all`, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Failed to load registered items.");
  }

  return data;
}

export async function getSecurityIncidents() {
  const token = localStorage.getItem("token");

  const response = await fetch(`${API_URL}/security-incidents`, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.message || "Failed to load security incidents."
    );
  }

  return data;
}

export async function createSecurityIncident(payload: {
  registered_item_id?: number | null;
  scanned_code?: string | null;
  incident_type: string;
  item_name?: string | null;
  serial_number?: string | null;
  gate: string;
  description?: string | null;
}) {
  const token = localStorage.getItem("token");

  const response = await fetch(`${API_URL}/security-incidents`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.message || "Failed to record security incident."
    );
  }

  return data;
}

export async function resolveSecurityIncident(id: number) {
  const token = localStorage.getItem("token");

  const response = await fetch(
    `${API_URL}/security-incidents/${id}/resolve`,
    {
      method: "PUT",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.message || "Failed to resolve security incident."
    );
  }

  return data;
}

export async function getLostFoundItems() {
  const token = localStorage.getItem("token");

  const response = await fetch(`${API_URL}/lost-found`, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.message || "Failed to load Lost & Found items."
    );
  }

  return data;
}



export async function claimLostFoundItem(id: number) {
  const token = localStorage.getItem("token");

  const response = await fetch(
    `${API_URL}/lost-found/${id}/claim`,
    {
      method: "PUT",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.message || "Failed to claim item."
    );
  }

  return data;
}

export async function getNotifications() {
  const token = localStorage.getItem("token");

  const response = await fetch(`${API_URL}/notifications`, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.message || "Failed to load notifications."
    );
  }

  return data;
}

export async function markNotificationRead(id: number) {
  const token = localStorage.getItem("token");

  const response = await fetch(
    `${API_URL}/notifications/${id}/read`,
    {
      method: "PUT",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.message || "Failed to mark notification as read."
    );
  }

  return data;
}

export async function markAllNotificationsRead() {
  const token = localStorage.getItem("token");

  const response = await fetch(
    `${API_URL}/notifications/read-all`,
    {
      method: "PUT",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.message || "Failed to mark all notifications as read."
    );
  }

  return data;
}

export async function getDashboard() {
  const token = localStorage.getItem("token");

  const response = await fetch(`${API_URL}/dashboard`, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.message || "Failed to load dashboard data."
    );
  }

  return data;
}

export async function getSystemRecords() {
  const token = localStorage.getItem("token");

  const response = await fetch(`${API_URL}/system-records`, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.message || "Failed to load system records."
    );
  }

  return data;
}

export async function getReports() {
  const token = localStorage.getItem("token");

  const response = await fetch(`${API_URL}/reports`, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.message || "Failed to load report data."
    );
  }

  return data;
}

export async function getUsers() {
  const token = localStorage.getItem("token");

  const response = await fetch(
    "http://localhost:8000/api/users",
    {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.message || "Failed to load users."
    );
  }

  return data;
}

export async function updateUserStatus(
  id: number,
  status: "approved" | "inactive"
) {
  const token = localStorage.getItem("token");

  const response = await fetch(
    `http://localhost:8000/api/users/${id}/status`,
    {
      method: "PUT",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        status,
      }),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.message ||
        "Failed to update user status."
    );
  }

  return data;
}

export async function createUser(userData: {
  name: string;
  email: string;
  username: string;
  role: "student" | "security" | "pco" | "sysadmin";
  password: string;
}) {
  const token = localStorage.getItem("token");

  const response = await fetch(
    "http://localhost:8000/api/users",
    {
      method: "POST",

      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },

      body: JSON.stringify(userData),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    if (data.errors) {
      const firstError = Object.values(
        data.errors
      )[0];

      if (
        Array.isArray(firstError) &&
        firstError.length > 0
      ) {
        throw new Error(
          String(firstError[0])
        );
      }
    }

    throw new Error(
      data.message ||
        "Failed to create user account."
    );
  }

  return data;
}

export async function updateUser(
  id: number,
  userData: {
    name: string;
    email: string;
    username: string;
    role: "student" | "security" | "pco" | "sysadmin";
  }
) {
  const token = localStorage.getItem("token");

  const response = await fetch(
    `http://localhost:8000/api/users/${id}`,
    {
      method: "PUT",

      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },

      body: JSON.stringify(userData),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    if (data.errors) {
      const firstError = Object.values(
        data.errors
      )[0];

      if (
        Array.isArray(firstError) &&
        firstError.length > 0
      ) {
        throw new Error(
          String(firstError[0])
        );
      }
    }

    throw new Error(
      data.message ||
        "Failed to update user account."
    );
  }

  return data;
}

export async function logout() {
  const token = localStorage.getItem("token");

  if (!token) {
    return {
      message: "No active session.",
    };
  }

  const response = await fetch(
    "http://localhost:8000/api/logout",
    {
      method: "POST",

      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.message ||
        "Failed to log out."
    );
  }

  return data;
}

export async function createLostFoundItem(data: {
  report_type: "found" | "lost";

  // Found report
  found_by_identifier?: string;
  location_found?: string;
  date_found?: string;

  // Lost report
  lost_by_identifier?: string;
  location_lost?: string;
  date_lost?: string;

  // Shared item details
  item_name: string;
  category?: string;
  brand_model?: string;
  color?: string;
  description?: string;
}) {
  const token =
    localStorage.getItem("token");

  const response = await fetch(
    "http://localhost:8000/api/lost-found",
    {
      method: "POST",

      headers: {
        Accept: "application/json",
        "Content-Type":
          "application/json",
        Authorization:
          `Bearer ${token}`,
      },

      body: JSON.stringify(data),
    }
  );

  const result =
    await response.json();

  if (!response.ok) {
    if (result.errors) {
      const firstError =
        Object.values(
          result.errors
        )[0];

      if (
        Array.isArray(
          firstError
        ) &&
        firstError.length > 0
      ) {
        throw new Error(
          String(
            firstError[0]
          )
        );
      }
    }

    throw new Error(
      result.message ||
        "Failed to save Lost & Found report."
    );
  }

  return result;
}

export async function markLostFoundRecovered(
  id: number,
  data?: {
    found_by_identifier: string;
    location_found: string;
    date_found: string;
  }
) {
  const token = localStorage.getItem("token");

  const response = await fetch(
    `http://localhost:8000/api/lost-found/${id}/recovered`,
    {
      method: "PUT",

      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },

      body: data
        ? JSON.stringify(data)
        : JSON.stringify({}),
    }
  );

  const result = await response.json();

  if (!response.ok) {
    if (result.errors) {
      const firstError =
        Object.values(result.errors)[0];

      if (
        Array.isArray(firstError) &&
        firstError.length > 0
      ) {
        throw new Error(
          String(firstError[0])
        );
      }
    }

    throw new Error(
      result.message ||
        "Failed to mark the item as recovered."
    );
  }

  return result;
}
// ============================================================================
// PASSWORD RESET
// ============================================================================

export async function requestPasswordReset(
  email: string
) {
  const response = await fetch(
    `${API_URL}/forgot-password`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        email,
      }),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.message ||
        "Unable to send verification code."
    );
  }

  return data;
}


export async function verifyPasswordResetCode(
  email: string,
  code: string
) {
  const response = await fetch(
    `${API_URL}/verify-reset-code`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        email,
        code,
      }),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.message ||
        "Invalid verification code."
    );
  }

  return data;
}


export async function resetPassword(
  email: string,
  code: string,
  password: string
) {
  const response = await fetch(
    `${API_URL}/reset-password`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        email,
        code,
        password,
        password_confirmation: password,
      }),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.message ||
        "Unable to reset password."
    );
  }

  return data;
}