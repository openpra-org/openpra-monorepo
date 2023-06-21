import { EuiCollapsibleNav, EuiCollapsibleNavGroup, EuiIcon, EuiListGroup } from '@elastic/eui';

export default function Sidenav() {
  const navItems = [
    {
      id: 'analysisNavGroup',
      title: 'Analysis',
      items: [
        {
            id: 'analysisNavGroup',
          label: 'Open State Analysis',
        },
        {
            id: 'analysisNavGroup',
          label: 'Initiating Event Analysis',
          icon: <EuiIcon type="folderClosed" />,
          items: [
            {
                id: 'analysisNavGroup',
              label: 'Initiating Events',
              href: '/model/1/bayesianNetworks',
            },
          ],
        },
        // Add more items as needed
      ],
    },
    // Add more groups and items as needed
  ];

  return (
    <EuiCollapsibleNav
      id="collapsibleNav"
      isOpen={true}
      onClose={() => {}}
      aria-label="Collapsible navigation"
      style={{maxWidth: "250px"}}
    >
      {navItems.map((navGroup) => (
        <EuiCollapsibleNavGroup
          key={navGroup.id}
          title={navGroup.title}
          isCollapsible={true}
          initialIsOpen={true}
        >
          <EuiListGroup listItems={navGroup.items} />

          {/* Render sub-items */}
          {navGroup.items.map((item) =>
            item.items ? (
              <EuiCollapsibleNavGroup
                key={item.id}
                title={item.label}
                isCollapsible={true}
                initialIsOpen={true}
              >
                <EuiListGroup listItems={item.items} />
              </EuiCollapsibleNavGroup>
            ) : null
          )}
        </EuiCollapsibleNavGroup>
      ))}
    </EuiCollapsibleNav>
  );
}
