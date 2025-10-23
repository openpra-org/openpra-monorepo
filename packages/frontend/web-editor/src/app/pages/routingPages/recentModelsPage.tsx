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

/**
 * RecentModelsPage
 * Displays a quick list of recent models across workspaces when landing on "/" while authenticated.
 * Note: We currently do not receive timestamps; items are displayed in the API/store order.
 */
export function RecentModelsPage(): JSX.Element {
  const [isLoading, setIsLoading] = useState(true);

  // Lists and loaders from global store
  const internalEvents = UseGlobalStore.use.InternalEvents();
  const setInternalEvents = UseGlobalStore.use.SetInternalEvents();
  const internalHazards = UseGlobalStore.use.InternalHazards();
  const setInternalHazards = UseGlobalStore.use.SetInternalHazards();

  useEffect(() => {
    let cancelled = false;
    const run = async (): Promise<void> => {
      try {
        await Promise.all([setInternalEvents(), setInternalHazards()]);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [setInternalEvents, setInternalHazards]);

  const topN = 5;
  const recentIE = useMemo(() => internalEvents.slice(0, topN), [internalEvents]);
  const recentIH = useMemo(() => internalHazards.slice(0, topN), [internalHazards]);

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
          <EuiFlexGroup gutterSize="l">
            <EuiFlexItem>
              <EuiTitle size="s">
                <h3>Internal Events</h3>
              </EuiTitle>
              <EuiListGroup
                flush
                bordered={false}
                maxWidth={false}
                gutterSize="s"
              >
                {recentIE.length === 0 ? (
                  <EuiListGroupItem
                    label="No models yet"
                    isDisabled
                  />
                ) : (
                  recentIE.map((m) => (
                    <EuiListGroupItem
                      key={m._id}
                      label={m.label?.name ?? m._id}
                      href={`/internal-events/${m._id}`}
                    />
                  ))
                )}
              </EuiListGroup>
            </EuiFlexItem>
            <EuiFlexItem>
              <EuiTitle size="s">
                <h3>Internal Hazards</h3>
              </EuiTitle>
              <EuiListGroup
                flush
                bordered={false}
                maxWidth={false}
                gutterSize="s"
              >
                {recentIH.length === 0 ? (
                  <EuiListGroupItem
                    label="No models yet"
                    isDisabled
                  />
                ) : (
                  recentIH.map((m) => (
                    <EuiListGroupItem
                      key={m._id}
                      label={m.label?.name ?? m._id}
                      href={`/internal-hazards/${m._id}`}
                    />
                  ))
                )}
              </EuiListGroup>
            </EuiFlexItem>
          </EuiFlexGroup>
        </EuiSkeletonRectangle>
      </EuiPageTemplate.Section>
    </EuiPageTemplate>
  );
}

export default RecentModelsPage;
