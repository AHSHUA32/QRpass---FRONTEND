import React, { useState, useId } from "react";
import {
  CheckCircle,
  Lock,
  User,
} from "lucide-react";

type Role = "student" | "security" | "sao" | "sysadmin";

type LoginMode =
  | "login"
  | "register"
  | "forgot"
  | "verify"
  | "reset"
  | "reset-done";