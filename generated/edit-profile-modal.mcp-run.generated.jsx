import { Modal, Input, Button } from "@hugo-ui/mui";

export function EditProfileModal({
  open,
  firstName,
  lastName,
  onFirstNameChange,
  onLastNameChange,
  onCancel,
  onSave,
  saving = false
}) {
  return (
    <Modal
      open={open}
      title="Edit profile"
      subTitle="Edit your profile by changing the information below."
      type="transactional"
      onClose={onCancel}
      footerComponent={
        <>
          <Button level="secondary" size="medium" onClick={onCancel}>
            Cancel
          </Button>
          <Button level="primary" size="medium" loading={saving} onClick={onSave}>
            Save changes
          </Button>
        </>
      }
    >
      <Input
        id="first-name"
        label="First name"
        name="firstName"
        value={firstName ?? ""}
        onChange={onFirstNameChange}
        fullWidth
      />
      <Input
        id="last-name"
        label="Last name"
        name="lastName"
        value={lastName ?? ""}
        onChange={onLastNameChange}
        fullWidth
      />
    </Modal>
  );
}
