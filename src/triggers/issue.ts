import sample from "../samples/issue.json";
import { ZObject, Bundle } from "zapier-platform-core";

interface TeamIssuesResponse {
  data: {
    team: {
      issues: {
        nodes: {
          id: string;
          identifier: string;
          url: string;
          title: string;
          description: string;
          priority: string;
          estimate: number;
          dueDate: Date;
          createdAt: Date;
          updatedAt: Date;
          creator: {
            id: string;
            name: string;
            email: string;
          };
          assignee?: {
            id: string;
            name: string;
            email: string;
          };
          state: {
            id: string;
            name: string;
            type: string;
          };
          labels: {
            nodes: {
              id: string;
              name: string;
            }[];
          };
          project?: {
            id: string;
            name: string;
          };
        }[];
      };
    };
  };
}

const buildIssueList = (orderBy: "createdAt" | "updatedAt") => async (z: ZObject, bundle: Bundle) => {
  if (!bundle.inputData.team_id) {
    throw new z.errors.HaltedError(`Please select the team first`);
  }
  const cursor = bundle.meta.page ? await z.cursor.get() : undefined;

  const response = await z.request({
    url: "https://api.linear.app/graphql",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      authorization: bundle.authData.api_key,
    },
    body: {
      query: `
      query GetTeamIssues(
        $teamId: String!
        $orderBy: PaginationOrderBy!
        $after: String
      ) {
        team(id: $teamId) {
          issues(first: 5, orderBy: $orderBy, after: $after) {
            nodes {
              id
              identifier
              url
              title
              description
              priority
              estimate
              dueDate
              createdAt
              updatedAt
              creator {
                id
                name
                email
              }
              assignee {
                id
                name
                email
              }
              state {
                id
                name
                type
              }
              labels {
                nodes {
                  id
                  name
                }
              }
              project {
                id
                name
              }
            }
          }
        }
      }
      `,
      variables: {
        teamId: bundle.inputData.team_id,
        orderBy,
        after: cursor
      },
    },
    method: "POST",
  });

  const data = (response.json as TeamIssuesResponse).data;
  let issues = data.team.issues.nodes;

  // Set cursor for pagination
  const nextCursor = issues?.[issues.length - 1]?.id
  if (nextCursor) {
    await z.cursor.set(nextCursor);
  }

  // Filter by fields if set
  if (bundle.inputData.status_id) {
    issues = issues.filter((issue) => issue.state.id === bundle.inputData.status_id);
  }
  if (bundle.inputData.creator_id) {
    issues = issues.filter((issue) => issue.creator.id === bundle.inputData.creator_id);
  }
  if (bundle.inputData.assignee_id) {
    issues = issues.filter((issue) => issue.assignee && issue.assignee.id === bundle.inputData.assignee_id);
  }
  if (bundle.inputData.priority) {
    issues = issues.filter((issue) => `${issue.priority}` === bundle.inputData.priority);
  }
  if (bundle.inputData.label_id) {
    issues = issues.filter(
      (issue) => issue.labels.nodes.find((label) => label.id === bundle.inputData.label_id) !== undefined
    );
  }
  if (bundle.inputData.project_id) {
    issues = issues.filter((issue) => issue.project && issue.project.id === bundle.inputData.project_id);
  }

  return issues.map((issue) => ({
    ...issue,
    id: `${issue.id}-${issue[orderBy]}`,
    issueId: issue.id,
  }));
};

const issue = {
  noun: "Issue",

  operation: {
    inputFields: [
      {
        required: true,
        label: "Team",
        key: "team_id",
        helpText: "The team for the issue.",
        dynamic: "team.id.name",
        altersDynamicFields: true,
      },
      {
        required: false,
        label: "Status",
        key: "status_id",
        helpText: "The issue status.",
        dynamic: "status.id.name",
        altersDynamicFields: true,
      },
      {
        required: false,
        label: "Creator",
        key: "creator_id",
        helpText: "The user who created this issue.",
        dynamic: "user.id.name",
        altersDynamicFields: true,
      },
      {
        required: false,
        label: "Assignee",
        key: "assignee_id",
        helpText: "The assignee of this issue.",
        dynamic: "user.id.name",
        altersDynamicFields: true,
      },
      {
        required: false,
        label: "Priority",
        key: "priority",
        helpText: "The priority of the issue.",
        choices: [
          { value: "0", sample: "0", label: "No priority" },
          { value: "1", sample: "1", label: "Urgent" },
          { value: "2", sample: "2", label: "High" },
          { value: "3", sample: "3", label: "Medium" },
          { value: "4", sample: "4", label: "Low" },
        ],
      },
      {
        required: false,
        label: "Label",
        key: "label_id",
        helpText: "Label which was assigned to the issue.",
        dynamic: "label.id.name",
        altersDynamicFields: true,
      },
      {
        required: false,
        label: "Project",
        key: "project_id",
        helpText: "Issue's project.",
        dynamic: "project.id.name",
        altersDynamicFields: true,
      },
    ],
    sample,
  },
};

export const newIssue = {
  ...issue,
  key: "newIssue",
  display: {
    label: "New Issue",
    description: "Triggers when a new issues is created.",
  },
  operation: {
    ...issue.operation,
    canPaginate: true,
    perform: buildIssueList("createdAt"),
  },
};

export const updatedIssue = {
  ...issue,
  key: "updatedIssue",
  display: {
    label: "Updated Issue",
    description: "Triggers when an issue issue is updated.",
  },
  operation: {
    ...issue.operation,
    canPaginate: true,
    perform: buildIssueList("updatedAt"),
  },
};
