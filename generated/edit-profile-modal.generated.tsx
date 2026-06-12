import { Button, Input, Modal } from "@hugo-ui/mui";

type EditProfileModalGeneratedProps = {
  open: boolean;
  onClose: () => void;
};

export function EditProfileModalGenerated({
  open,
  onClose
}: EditProfileModalGeneratedProps) {
  const handleSave = () => undefined;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Edit profile"
      subTitle="Edit your profile by changing the information below."
      type="transactional"
      footerComponent={
        <>
          <Button
            level="secondary"
            colorTheme="purple"
            size="medium"
            type="button"
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            level="primary"
            colorTheme="purple"
            size="medium"
            type="button"
            onClick={handleSave}
          >
            Save changes
          </Button>
        </>
      }
    >
      <Input
        id="first-name"
        label="First name"
        required={false}
      />
      <Input
        id="last-name"
        label="Last name"
        required={false}
      />
    </Modal>
  );
}
