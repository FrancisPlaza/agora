import type { Metadata } from "next";
import { RegisterForm } from "./form";

export const metadata: Metadata = { title: "Register" };

export default function Register() {
  return <RegisterForm />;
}
