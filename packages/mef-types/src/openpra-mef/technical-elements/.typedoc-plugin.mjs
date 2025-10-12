/**
 * A simple TypeDoc plugin to handle multiple @remarks and @returns tags
 */

/**
 * Load function for the plugin
 * @param {import('typedoc').Application} app - The TypeDoc application
 */
export function load(app) {
  // Add a handler for the 'comment' event
  app.converter.on('comment', (context, comment) => {
    if (!comment || !comment.blockTags || comment.blockTags.length === 0) {
      return comment;
    }

    // Process @remarks tags
    const remarksTags = comment.blockTags.filter(tag => tag.tag === '@remarks');
    if (remarksTags.length > 1) {
      // Combine all remarks content
      const combinedContent = remarksTags.map(tag => tag.content).join('\n\n');
      
      // Keep only the first tag with combined content
      remarksTags[0].content = combinedContent;
      
      // Filter out other @remarks tags
      comment.blockTags = comment.blockTags.filter(
        tag => tag.tag !== '@remarks' || tag === remarksTags[0]
      );
    }
    
    // Process @returns tags
    const returnsTags = comment.blockTags.filter(tag => tag.tag === '@returns');
    if (returnsTags.length > 1) {
      // Combine all returns content
      const combinedContent = returnsTags.map(tag => tag.content).join('\n\n');
      
      // Keep only the first tag with combined content
      returnsTags[0].content = combinedContent;
      
      // Filter out other @returns tags
      comment.blockTags = comment.blockTags.filter(
        tag => tag.tag !== '@returns' || tag === returnsTags[0]
      );
    }
    
    return comment;
  });
} 