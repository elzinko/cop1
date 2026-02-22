export interface StoryContext {
  storyId: string;
  storyContent: string;
  projectPath: string;
}

export class StoryContextBuilder {
  build(story: StoryContext): Record<string, string> {
    const context: Record<string, string> = {
      projectPath: story.projectPath,
    };

    context.story = this.formatStorySection(story.storyId, story.storyContent);

    return context;
  }

  private formatStorySection(storyId: string, storyContent: string): string {
    return [`# Story: ${storyId}`, '', storyContent].join('\n');
  }
}
