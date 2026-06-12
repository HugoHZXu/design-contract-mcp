import figma from "figma";
import { Input } from "@hugo-ui/mui";

// Local shape mock only. This file is not parsed or published by Code Connect.
export default {
  id: "mock:Form/Input",
  component: Input,
  figmaComponent: "Form/Input",
  props: {
    label: figma.string("Label"),
    required: figma.boolean("Required")
  },
  example: figma.code`
    <Input
      label={${figma.string("Label")}}
      required={${figma.boolean("Required")}}
    />
  `
};
