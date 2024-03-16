import {
  EuiListGroup,
  EuiSelectable,
  EuiListGroupItem,
  EuiSelectableOption, EuiSelectableProps,
  EuiText,
  EuiToken
} from "@elastic/eui";
import {useNavigate} from "react-router-dom";
import {useEffect, useRef, useState} from "react";
import {SelectableWorkspaceOptions} from "../../workspaces/SelectableWorkspaceOptions";

export default function HomeSideNav(): JSX.Element {
  const navigate = useNavigate();
  const isMountedRef = useRef(false);
  const [spaces, setSpaces] = useState<EuiSelectableOption[]>(
    SelectableWorkspaceOptions,
  );
  const [selectedSpace, setSelectedSpace] = useState(
    spaces.filter((option) => option.checked)[0],
  );

  const onChangeWorkSpace: EuiSelectableProps["onChange"] = (options) => {
    setSpaces(options);
    setSelectedSpace(() => options.filter((option) => option.checked)[0]);
  };

  useEffect(() => {
    if (isMountedRef.current) {
      navigate("/" + selectedSpace.key);
    }

    return () => {
      isMountedRef.current = true;
    };
  }, [selectedSpace]);
  const workSpaces = [
    {
      id:1,
      title:(
        <EuiText
          color={"primary"}
          title={"Internal Events"}
        >
          {"Internal Events"}
        </EuiText>
      ),
      navigateTo: "internal-events",
      icon: <EuiToken iconType={"beaker"} />,
      onClick: (): void => {
        navigate("internal-events")
      }
    },
    {
      id: 2,
      title: (
        <EuiText
          color={"primary"}
          title={"Internal Hazards"}
        >
          {"Internal Hazards"}
        </EuiText>
      ),
      navigateTo: "internal-hazards",
      icon: <EuiToken iconType={"brush"} />,
      onClick: (): void => {
        navigate("internal-hazards")
      }
    },
    {
      id: 3,
      title:(
        <EuiText
          color={"primary"}
          title={"External Hazards"}
        >
          {"External Hazards"}
        </EuiText>
      ),
      navigateTo: "external-hazards",
      icon: <EuiToken iconType={"brush"} />,
      onClick: (): void => {
        navigate("external-hazards")
      }
    },
    {
      id: 4,
      title: (
        <EuiText
          color={"primary"}
          title={"Full Scope"}
        >
          {"Full Scope"}
        </EuiText>
      ),
      navigateTo: "full-scope",
      icon: <EuiToken iconType={"node"} />,
      onClick: (): void => {
        navigate("full-scope")
      }
    },
    {
      id: 5,
      title: (
        <EuiText
          color={"primary"}
          title={"Data Analysis"}
        >
          {"Data Analysis"}
        </EuiText>
      ),
      navigateTo: "data-analysis",
      icon: <EuiToken iconType={"node"} />,
      onClick: (): void => {
        navigate("data-analysis")
      }
    },
    {
      id: 6,
      title: (
        <EuiText
          color={"primary"}
          title={"Physical Security"}
        >
          {"Physical Security"}
        </EuiText>
      ),
      navigateTo: "physical-security",
      icon: <EuiToken iconType={"node"} />,
      onClick: (): void => {
        navigate("physical-security")
      }
    },
    {
      id: 7,
      title: (
        <EuiText
          color={"primary"}
          title={"Cybersecurity"}
        >
          {"Cybersecurity"}
        </EuiText>
      ),
      navigateTo: "cybersecurity",
      icon: <EuiToken iconType={"node"} />,
      onClick: (): void => {
        navigate("cybersecurity")
      }
    },

  ]
  return (
    <>
      <EuiListGroupItem
        label={<EuiText>Your WorkSpaces</EuiText>}
      />
      <EuiListGroup>
        {workSpaces.map((workSpace) => {
          return (
            <EuiListGroupItem
              key={workSpace.id}
              icon={workSpace.icon}
              onClick={workSpace.onClick}
              label={workSpace.title}
            />
          );
        })}
      </EuiListGroup>

      {/*<EuiSelectable*/}
      {/*  options={spaces}*/}
      {/*  singleSelection="always"*/}
      {/*  onChange={onChangeWorkSpace}*/}
      {/*  listProps={{*/}
      {/*    rowHeight: 40,*/}
      {/*    showIcons: false,*/}
      {/*    paddingSize: "s",*/}
      {/*    bordered: false,*/}
      {/*  }}*/}
      {/*>*/}
      {/*  {(list, search) => (*/}
      {/*    <>*/}
      {/*      {list}*/}
      {/*    </>*/}
      {/*  )}*/}
      {/*</EuiSelectable>*/}
    </>
  )
}
