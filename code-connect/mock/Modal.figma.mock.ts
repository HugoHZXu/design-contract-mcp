import figma from "figma";
import { Modal } from "@hugo-ui/mui";

// Local shape mock only. This file is not parsed or published by Code Connect.
export default {
  id: "mock:Dialog/Modal",
  component: Modal,
  figmaComponent: "Dialog/Modal",
  props: {
    open: figma.boolean("State"),
    title: figma.string("Title"),
    subTitle: figma.string("Description"),
    type: figma.enum("Type", {
      Transactional: "transactional"
    })
  },
  example: figma.code`
    <Modal
      open={${figma.boolean("State")}}
      title={${figma.string("Title")}}
      subTitle={${figma.string("Description")}}
      type={${figma.enum("Type", {
        Transactional: "transactional"
      })}}
    />
  `
};
