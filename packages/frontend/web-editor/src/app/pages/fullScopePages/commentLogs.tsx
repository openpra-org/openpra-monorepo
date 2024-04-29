import React, { useState, useEffect, useRef } from 'react';
import {
  formatDate,
  htmlIdGenerator,
  EuiCommentList,
  EuiComment,
  EuiCommentProps,
  EuiButtonIcon,
  EuiBadge,
  EuiMarkdownEditor,
  EuiMarkdownFormat,
  EuiSpacer,
  EuiFlexGroup,
  EuiFlexItem,
  EuiButton,
  EuiToolTip,
  EuiAvatar, EuiHorizontalRule,
} from '@elastic/eui';
const actionButton = (
  <EuiButtonIcon
    title="Custom action"
    aria-label="Custom action"
    color="text"
    iconType="copy"
  />
);
const complexEvent = (
  <EuiFlexGroup responsive={false} alignItems="center" gutterSize="xs" wrap>
    <EuiFlexItem grow={false}>added tags</EuiFlexItem>
    <EuiFlexItem grow={false}>
      <EuiBadge>case</EuiBadge>
    </EuiFlexItem>
    <EuiFlexItem grow={false}>
      <EuiBadge>phising</EuiBadge>
    </EuiFlexItem>
    <EuiFlexItem grow={false}>
      <EuiBadge>security</EuiBadge>
    </EuiFlexItem>
  </EuiFlexGroup>
);
const UserActionUsername = ({
                              username,
                              fullname,
                            }: {
  username: string;
  fullname: string;
}) => {
  return (
    <EuiToolTip position="top" content={<p>{fullname}</p>}>
      <strong>{username}</strong>
    </EuiToolTip>
  );
};
const initialComments: EuiCommentProps[] = [
  {
    username: <UserActionUsername username="emma" fullname="Emma Watson" />,
    timelineAvatar: <EuiAvatar name="emma" />,
    event: 'added a comment',
    timestamp: 'on 3rd March 2022',
    children: (
      <EuiMarkdownFormat textSize="s">
        Phishing emails have been on the rise since February
      </EuiMarkdownFormat>
    ),
    actions: actionButton,
  },
  {
    username: <UserActionUsername username="emma" fullname="Emma Watson" />,
    timelineAvatar: <EuiAvatar name="emma" />,
    event: complexEvent,
    timestamp: 'on 3rd March 2022',
    eventIcon: 'tag',
    eventIconAriaLabel: 'tag',
  },
  {
    username: 'system',
    timelineAvatar: 'dot',
    timelineAvatarAriaLabel: 'System',
    event: 'pushed a new incident',
    timestamp: 'on 4th March 2022',
    eventColor: 'danger',
  },
  {
    username: <UserActionUsername username="tiago" fullname="Tiago Pontes" />,
    timelineAvatar: <EuiAvatar name="tiago" />,
    event: 'added a comment',
    timestamp: 'on 4th March 2022',
    actions: actionButton,
    children: (
      <EuiMarkdownFormat textSize="s">
        Take a look at this
        [Office.exe](http://my-drive.elastic.co/suspicious-file)
      </EuiMarkdownFormat>
    ),
  },
  {
    username: <UserActionUsername username="emma" fullname="Emma Watson" />,
    timelineAvatar: <EuiAvatar name="emma" />,
    event: (
      <>
        marked case as <EuiBadge color="warning">In progress</EuiBadge>
      </>
    ),
    timestamp: 'on 4th March 2022',
  },
];
const replyMsg = `Thanks, Tiago for taking a look. :tada:
I also found something suspicious: [Update.exe](http://my-drive.elastic.co/suspicious-file).
`;
export default () => {
  const errorElementId = useRef(htmlIdGenerator()());
  const [editorValue, setEditorValue] = useState(replyMsg);
  const [comments, setComments] = useState(initialComments);
  const [isLoading, setIsLoading] = useState(false);
  const [editorError, setEditorError] = useState(true);
  useEffect(() => {
    if (editorValue === '') {
      setEditorError(true);
    } else {
      setEditorError(false);
    }
  }, [editorValue, editorError]);
  const onAddComment = () => {
    setIsLoading(true);
    const date = formatDate(Date.now(), 'dobLong');
    setTimeout(() => {
      setIsLoading(false);
      setEditorValue('');
      setComments([
        ...comments,
        {
          username: (
            <UserActionUsername username="emma" fullname="Emma Watson" />
          ),
          timelineAvatar: <EuiAvatar name="emma" />,
          event: 'added a comment',
          timestamp: `on ${date}`,
          actions: actionButton,
          children: (
            <EuiMarkdownFormat textSize="s">{editorValue}</EuiMarkdownFormat>
          ),
        },
      ]);
    }, 3000);
  };
  const commentsList = comments.map((comment, index) => {
    return (
      <EuiComment key={`comment-${index}`} {...comment}>
        {comment.children}
      </EuiComment>
    );
  });

  const containerStyle = {
    marginTop: '30px', // Adjust the value as needed
  };

  const dividerStyle = {
    marginBottom: '30px', // Margin below the divider
  };

  return (
    <>
      <div style={containerStyle}>
        <EuiHorizontalRule style={dividerStyle} margin="none" /> {/* Add a horizontal rule */}
        <EuiCommentList aria-label="Comment system example">
        {commentsList}
        <EuiComment
          username="juana"
          timelineAvatar={<EuiAvatar name="juana" />}
        >
          <EuiMarkdownEditor
            aria-label="Markdown editor"
            aria-describedby={errorElementId.current}
            placeholder="Add a comment..."
            value={editorValue}
            onChange={setEditorValue}
            readOnly={isLoading}
            initialViewMode="editing"
            markdownFormatProps={{ textSize: 's' }}
          />
        </EuiComment>
      </EuiCommentList>
      <EuiSpacer />
      <EuiFlexGroup justifyContent="flexEnd" responsive={false}>
        <EuiFlexItem grow={false}>
          <div>
            <EuiButton
              onClick={onAddComment}
              isLoading={isLoading}
              isDisabled={editorError}
            >
              Add comment
            </EuiButton>
          </div>
        </EuiFlexItem>
      </EuiFlexGroup>
      </div>
    </>
  );
};
