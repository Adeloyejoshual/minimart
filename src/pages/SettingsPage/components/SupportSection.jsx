import SettingsSection from "./SettingsSection.jsx";
import SettingsItem    from "./SettingsItem.jsx";

const HELP_URL    = "https://help.loemart.com";
const SUPPORT_URL = "https://help.loemart.com/contact";

export default function SupportSection() {
  return (
    <SettingsSection title="Support">

      <SettingsItem
        icon="❓"
        label="Help Center"
        href={HELP_URL}
      />

      <SettingsItem
        icon="💬"
        label="Contact Support"
        href={SUPPORT_URL}
        last
      />

    </SettingsSection>
  );
}