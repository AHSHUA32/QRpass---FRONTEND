import React, { useState, useId } from "react";
import {
  CheckCircle,
  Lock,
  User,
} from "lucide-react";

<<<<<<< HEAD
type Role = "student" | "security" | "sao" | "sysadmin";
=======
type Role = "student" | "security" | "pco" | "sysadmin";
>>>>>>> c35ea7e (Standardize PCO role and update QRPass frontend)

type LoginMode =
  | "login"
  | "register"
  | "forgot"
  | "verify"
  | "reset"
  | "reset-done";