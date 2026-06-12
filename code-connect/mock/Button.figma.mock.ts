import figma from "figma";
import { Button } from "@hugo-ui/mui";

// Local shape mock only. This file is not parsed or published by Code Connect.
export default {
  id: "mock:Action/Button",
  component: Button,
  figmaComponent: "Action/Button",
  props: {
    children: figma.string("Label"),
    level: figma.enum("Hierarchy", {
      Primary: "primary",
      Secondary: "secondary"
    }),
    size: figma.enum("Size", {
      Medium: "medium"
    })
  },
  example: figma.code`
    <Button
      level={${figma.enum("Hierarchy", {
        Primary: "primary",
        Secondary: "secondary"
      })}}
      size={${figma.enum("Size", {
        Medium: "medium"
      })}}
    >
      ${figma.string("Label")}
    </Button>
  `
};
