import { useEffect, useMemo, useState } from "react";
import {
  EuiPageTemplate,
  EuiSkeletonRectangle,
  EuiTitle,
  EuiSpacer,
  EuiListGroup,
  EuiListGroupItem,
  EuiFlexGroup,
  EuiFlexItem,
  EuiText,
} from "@elastic/eui";
import { UseGlobalStore } from "../../zustand/Store";
const TOP_N = 5;
export function RecentModelsPage(): JSX.Element {
  const [isLoading, setIsLoading] = useState(true);
  const internalEvents = UseGlobalStore.use.InternalEvents();
  const setInternalEvents = UseGlobalStore.use.SetInternalEvents();
  const internalHazards = UseGlobalStore.use.InternalHazards();
  const setInternalHazards = UseGlobalStore.use.SetInternalHazards();
  const externalHazards = UseGlobalStore.use.ExternalHazards();
  const setExternalHazards = UseGlobalStore.use.SetExternalHazards();
  const fullScope = UseGlobalStore.use.FullScope();
  const setFullScope = UseGlobalStore.use.SetFullScope();
  useEffect(() => {
    let cancelled = false;
    const run = async (): Promise<void> => {
      try {
        await Promise.all([setInternalEvents(), setInternalHazards(), setExternalHazards(), setFullScope()]);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [setInternalEvents, setInternalHazards, setExternalHazards, setFullScope]);
  const recentIE = useMemo(() => internalEvents.slice(0, TOP_N), [internalEvents]);
  const recentIH = useMemo(() => internalHazards.slice(0, TOP_N), [internalHazards]);
  const recentEH = useMemo(() => externalHazards.slice(0, TOP_N), [externalHazards]);
  const recentFS = useMemo(() => fullScope.slice(0, TOP_N), [fullScope]);
  const renderList = (
    items: {
      _id: string;
      id: number;
      label?: {
        name?: string;
      };
    }[],
    basePath: string,
  ): JSX.Element => (
    <EuiListGroup
      flush
      bordered={false}
      maxWidth={false}
      gutterSize="s"
    >
      {items.length === 0 ?
        <EuiListGroupItem
          label="No models yet"
          isDisabled
        />
      : items.map((m) => (
          <EuiListGroupItem
            key={m._id}
            label={m.label?.name ?? m._id}
            href={`/${basePath}/${m.id}`}
          />
        ))
      }
    </EuiListGroup>
  );
  return (
    <EuiPageTemplate
      panelled={false}
      offset={48}
      grow
      restrictWidth
    >
      <EuiPageTemplate.Section>
        <EuiTitle size="l">
          <h2>Welcome back</h2>
        </EuiTitle>
        <EuiText color="subdued">
          <p>Jump into a recent model or pick a workspace from the menu.</p>
        </EuiText>
        <EuiSpacer size="m" />

        <EuiSkeletonRectangle
          isLoading={isLoading}
          width="100%"
          height={isLoading ? 300 : undefined}
          borderRadius="m"
        >
          <EuiFlexGroup
            gutterSize="l"
            wrap
          >
            <EuiFlexItem style={{ minWidth: 180 }}>
              <EuiTitle size="s">
                <h3>Internal Events</h3>
              </EuiTitle>
              {renderList(recentIE, "internal-events")}
            </EuiFlexItem>
            <EuiFlexItem style={{ minWidth: 180 }}>
              <EuiTitle size="s">
                <h3>Internal Hazards</h3>
              </EuiTitle>
              {renderList(recentIH, "internal-hazards")}
            </EuiFlexItem>
            <EuiFlexItem style={{ minWidth: 180 }}>
              <EuiTitle size="s">
                <h3>External Hazards</h3>
              </EuiTitle>
              {renderList(recentEH, "external-hazards")}
            </EuiFlexItem>
            <EuiFlexItem style={{ minWidth: 180 }}>
              <EuiTitle size="s">
                <h3>Full Scope</h3>
              </EuiTitle>
              {renderList(recentFS, "full-scope")}
            </EuiFlexItem>
          </EuiFlexGroup>
        </EuiSkeletonRectangle>
      </EuiPageTemplate.Section>
    </EuiPageTemplate>
  );
}
export default RecentModelsPage;
