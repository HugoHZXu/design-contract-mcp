// @ts-nocheck
// Intentional invalid sample used to demonstrate validator failures.
import { Button } from "@not-hugo-ui/mui";

export function InvalidGeneratedUsage() {
  return (
    <Button variant="primary" color="#FF0000" style={{ color: "#FF0000" }}>
      Save changes
    </Button>
  );
}
