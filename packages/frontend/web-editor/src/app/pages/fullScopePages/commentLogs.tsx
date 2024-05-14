import React, { useState, useEffect, useRef, RefObject } from 'react';
import {
  formatDate,
  htmlIdGenerator,
  EuiCommentList,
  EuiComment,
  EuiButtonIcon,
  EuiBadge,
  EuiMarkdownEditor,
  EuiMarkdownFormat,
  EuiSpacer,
  EuiFlexGroup,
  EuiFlexItem,
  EuiButton,
  EuiToolTip,
  EuiAvatar, EuiHorizontalRule, EuiFieldText, EuiButtonEmpty,
} from '@elastic/eui';

const CommentComponent = ({
                            commentsList,
                            errorElementId,
                            editorValue,
                            setEditorValue,
                            isLoading,
                            onAddComment,
                            editorError,
                           }: {
  commentsList: React.ReactNode; // ReactNode is a suitable type for JSX elements
  errorElementId: RefObject<HTMLElement>; // RefObject<HTMLElement> for useRef usage
  editorValue: string;
  setEditorValue: React.Dispatch<React.SetStateAction<string>>; // Dispatch function for state updates
  isLoading: boolean;
  onAddComment: () => void; // Function to handle adding a comment
  editorError: boolean; // Boolean flag for editor error state
}) => {
  return (
    <>
        <div >
            <EuiHorizontalRule margin="none" style={{ marginTop: '30px', marginBottom: '30px' }}/>
            <EuiCommentList aria-label="Comment system example">
        {commentsList}

        <EuiComment
          username="first_person"
          timelineAvatar={<EuiAvatar name="First" />}
          // actions={customActions} // Use customActions prop here

        >
          <EuiMarkdownEditor
            aria-label="Markdown editor"
            aria-describedby={errorElementId.current?.id ?? undefined} // Ensure errorElementId.current is converted to a string
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

export default CommentComponent;
