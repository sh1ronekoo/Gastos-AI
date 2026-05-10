import type { ReactNode } from "react";
import PrototypeShell from "./prototype-shell";

export default function PrototypeLayout({ children }: { children: ReactNode }) {
  return <PrototypeShell>{children}</PrototypeShell>;
}
