import { useLocation } from "react-router-dom";
import { Link } from "react-router-dom";
import { EuiButtonEmpty } from "@elastic/eui";

const CreateSettingButton = (): JSX.Element => {
  const location = useLocation().pathname;
  const settings_path = location + "/settings";

  return (
    <Link to={settings_path}>
      <EuiButtonEmpty size="s" color="text" iconType="gear">
        Settings
      </EuiButtonEmpty>
    </Link>
  );
};

export { CreateSettingButton };
