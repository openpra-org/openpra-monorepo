export const nodeData = [
  {
    width: 140,
    height: 50,
    id: "lvoq1ktmlsxhy78dlg",
    position: {
      x: 0,
      y: 0,
    },
    data: {
      inputDepth: 2,
      outputDepth: 1,
      width: 140,
      option: "",
      depth: 1,
      index: 1,
    },
    type: "visibleNode",
    positionAbsolute: {
      x: 0,
      y: 0,
    },
  },
  {
    width: 140,
    height: 50,
    id: "lvoq1ktmq3mp7ywl95d",
    position: {
      x: 58.19333332777023,
      y: -17.457999998331072,
    },
    data: {
      depth: 2,
      width: 140,
      option: "",
      output: false,
    },
    type: "visibleNode",
    positionAbsolute: {
      x: 58.19333332777023,
      y: -17.457999998331072,
    },
  },
  {
    width: 140,
    height: 50,
    id: "lvoq1ktmgx4v9ehp2q5",
    position: {
      x: 58.19333332777023,
      y: 17.457999998331072,
    },
    data: {
      depth: 2,
      width: 140,
      option: "",
      output: false,
    },
    type: "visibleNode",
    positionAbsolute: {
      x: 58.19333332777023,
      y: 17.457999998331072,
    },
  },
  {
    width: 140,
    height: 50,
    id: "lvoq1ktmw0tqquexym",
    position: {
      x: 116.38666665554047,
      y: -17.457999998331072,
    },
    data: {
      depth: 3,
      width: 140,
      output: true,
    },
    type: "outputNode",
    positionAbsolute: {
      x: 116.38666665554047,
      y: -17.457999998331072,
    },
  },
  {
    width: 140,
    height: 50,
    id: "lvoq1ktmjgzlo3aco5t",
    position: {
      x: 116.38666665554047,
      y: 17.457999998331072,
    },
    data: {
      depth: 3,
      width: 140,
      output: true,
    },
    type: "outputNode",
    positionAbsolute: {
      x: 116.38666665554047,
      y: 17.457999998331072,
    },
  },
  {
    width: 140,
    height: 65,
    id: "lvoq1ktmxc722bhvpwp",
    position: {
      x: 0,
      y: -150,
    },
    data: {
      value: "Initiating Event",
      width: 140,
      depth: 1,
      output: false,
      height: 33,
    },
    type: "columnNode",
    positionAbsolute: {
      x: 0,
      y: -62.349999994039536,
    },
  },
  {
    width: 140,
    height: 65,
    id: "lvoq1ktmabht261vtld",
    position: {
      x: 140,
      y: -150,
    },
    data: {
      value: "Functional Event",
      width: 140,
      depth: 2,
      output: false,
      height: 33,
    },
    type: "columnNode",
    positionAbsolute: {
      x: 58.19333332777023,
      y: -62.349999994039536,
    },
  },
  {
    width: 140,
    height: 65,
    id: "lvoq1ktn4ru2hb2rmbr",
    position: {
      x: 280,
      y: -150,
    },
    data: {
      value: "End State",
      width: 140,
      depth: 3,
      output: true,
      height: 33,
    },
    type: "columnNode",
    positionAbsolute: {
      x: 116.38666665554047,
      y: -62.349999994039536,
    },
  },
];

export const edgeData = [
  {
    id: "lvoq1ktmlsxhy78dlg-lvoq1ktmq3mp7ywl95d",
    source: "lvoq1ktmlsxhy78dlg",
    target: "lvoq1ktmq3mp7ywl95d",
    type: "custom",
    animated: false,
  },
  {
    id: "lvoq1ktmlsxhy78dlg-lvoq1ktmgx4v9ehp2q5",
    source: "lvoq1ktmlsxhy78dlg",
    target: "lvoq1ktmgx4v9ehp2q5",
    type: "custom",
    animated: false,
  },
  {
    id: "lvoq1ktmq3mp7ywl95d-lvoq1ktmw0tqquexym",
    source: "lvoq1ktmq3mp7ywl95d",
    target: "lvoq1ktmw0tqquexym",
    type: "custom",
    animated: true,
  },
  {
    id: "lvoq1ktmgx4v9ehp2q5-lvoq1ktmjgzlo3aco5t",
    source: "lvoq1ktmgx4v9ehp2q5",
    target: "lvoq1ktmjgzlo3aco5t",
    type: "custom",
    animated: true,
  },
  {
    id: "lvoq1ktmxc722bhvpwp--lvoq1ktmabht261vtld",
    source: "lvoq1ktmxc722bhvpwp",
    target: "lvoq1ktmabht261vtld",
    type: "custom",
    hidden: true,
    animated: true,
  },
  {
    id: "lvoq1ktmabht261vtld--lvoq1ktn4ru2hb2rmbr",
    source: "lvoq1ktmabht261vtld",
    target: "lvoq1ktn4ru2hb2rmbr",
    type: "custom",
    hidden: true,
    animated: true,
  },
];
