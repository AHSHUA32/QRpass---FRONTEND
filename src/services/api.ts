const API_URL = "http://localhost:8000/api";

export async function login(
  username: string,
  password: string,
  role: string
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
      role,
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

