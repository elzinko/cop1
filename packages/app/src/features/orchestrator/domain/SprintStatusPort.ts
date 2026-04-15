/**
 * EA12-S4 / A6 pivot — replaces the former `SprintStatusReaderPort` from
 * `sprint-core`. Status queries ultimately route through
 * `/bmad-bmm-sprint-status` workflow invocation (see `BmadCommandStatusAdapter`
 * follow-up in V1.1 backlog). The current `YamlSprintStatusAdapter` is an
 * interim localization of the file-level coupling to a single module.
 */
export interface SprintStatusPort {
  getStoryStatus(storyId: string): string | null;
  getAllStatuses(): Map<string, string>;
}
