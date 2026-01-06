import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  FileText,
  Code,
  Database,
  GitBranch,
  FileCode,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  Download,
  Users,
  AlertCircle,
  ExternalLink,
} from "lucide-react";
import MermaidRenderer from "./mermaid-renderer";
import type {
  RDAnalysisResult,
  UserStory,
  Requirement,
  APIEndpoint,
  DatabaseTable,
  TechnicalDecision,
  MermaidDiagram,
} from "@/lib/types";

interface RDAnalysisProps {
  analysis: RDAnalysisResult;
  onExportMarkdown?: () => void;
  onExportJSON?: () => void;
}

type TabId = "stories" | "api" | "db" | "diagrams" | "decisions";

interface Tab {
  id: TabId;
  label: string;
  icon: React.ReactNode;
  count?: number;
}

export default function RDAnalysis({
  analysis,
  onExportMarkdown,
  onExportJSON,
}: RDAnalysisProps) {
  const [activeTab, setActiveTab] = useState<TabId>("stories");
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const { documents, diagrams, metadata } = analysis;

  const tabs: Tab[] = [
    {
      id: "stories",
      label: "Stories",
      icon: <Users className="w-4 h-4" />,
      count: documents?.userStories?.length || 0,
    },
    {
      id: "api",
      label: "API",
      icon: <Code className="w-4 h-4" />,
      count: documents?.apiDesign?.length || 0,
    },
    {
      id: "db",
      label: "DB",
      icon: <Database className="w-4 h-4" />,
      count: documents?.databaseDesign?.length || 0,
    },
    {
      id: "diagrams",
      label: "圖表",
      icon: <GitBranch className="w-4 h-4" />,
      count: diagrams
        ? Object.values(diagrams).filter((d) => d !== null).length
        : 0,
    },
    {
      id: "decisions",
      label: "決策",
      icon: <FileCode className="w-4 h-4" />,
      count: documents?.technicalDecisions?.length || 0,
    },
  ];

  const toggleExpand = (id: string) => {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleCopy = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high":
      case "must":
        return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300";
      case "medium":
      case "should":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300";
      case "low":
      case "could":
        return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300";
      case "wont":
        return "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400";
      default:
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300";
    }
  };

  const getMethodColor = (method: string) => {
    switch (method) {
      case "GET":
        return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300";
      case "POST":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300";
      case "PUT":
      case "PATCH":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300";
      case "DELETE":
        return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "accepted":
        return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300";
      case "proposed":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300";
      case "deprecated":
        return "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300";
    }
  };

  const renderUserStories = () => {
    const stories = documents?.userStories || [];
    if (stories.length === 0) {
      return <EmptyState message="此討論未產出 User Stories" />;
    }

    return (
      <div className="space-y-4">
        {stories.map((story: UserStory, index: number) => (
          <div
            key={story.id || index}
            className="border border-border rounded-xl overflow-hidden"
          >
            <button
              onClick={() => toggleExpand(`story-${index}`)}
              className="w-full px-4 py-3 flex items-center justify-between bg-card hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono text-muted-foreground">
                  {story.id}
                </span>
                <span className="font-medium text-foreground">
                  {story.iWant?.substring(0, 50)}
                  {(story.iWant?.length || 0) > 50 ? "..." : ""}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`px-2 py-0.5 text-xs font-medium rounded-full ${getPriorityColor(
                    story.priority
                  )}`}
                >
                  {story.priority === "high"
                    ? "高"
                    : story.priority === "medium"
                    ? "中"
                    : "低"}
                </span>
                {expandedItems.has(`story-${index}`) ? (
                  <ChevronUp className="w-4 h-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                )}
              </div>
            </button>
            {expandedItems.has(`story-${index}`) && (
              <div className="px-4 py-3 bg-muted/20 border-t border-border space-y-3">
                <div>
                  <span className="text-sm text-muted-foreground">作為</span>
                  <p className="text-foreground">{story.asA}</p>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">我想要</span>
                  <p className="text-foreground">{story.iWant}</p>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">以便</span>
                  <p className="text-foreground">{story.soThat}</p>
                </div>
                {story.acceptanceCriteria &&
                  story.acceptanceCriteria.length > 0 && (
                    <div>
                      <span className="text-sm text-muted-foreground">
                        驗收條件
                      </span>
                      <ul className="list-disc list-inside mt-1 space-y-1">
                        {story.acceptanceCriteria.map((criteria, i) => (
                          <li key={i} className="text-sm text-foreground">
                            {criteria}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };

  const renderAPIDesign = () => {
    const apis = documents?.apiDesign || [];
    if (apis.length === 0) {
      return <EmptyState message="此討論未產出 API 設計" />;
    }

    return (
      <div className="space-y-4">
        {apis.map((api: APIEndpoint, index: number) => (
          <div
            key={index}
            className="border border-border rounded-xl overflow-hidden"
          >
            <button
              onClick={() => toggleExpand(`api-${index}`)}
              className="w-full px-4 py-3 flex items-center justify-between bg-card hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span
                  className={`px-2 py-0.5 text-xs font-bold rounded ${getMethodColor(
                    api.method
                  )}`}
                >
                  {api.method}
                </span>
                <code className="text-sm font-mono text-foreground">
                  {api.path}
                </code>
              </div>
              {expandedItems.has(`api-${index}`) ? (
                <ChevronUp className="w-4 h-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              )}
            </button>
            {expandedItems.has(`api-${index}`) && (
              <div className="px-4 py-3 bg-muted/20 border-t border-border space-y-3">
                <p className="text-sm text-foreground">{api.description}</p>
                {api.authentication && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">認證:</span>
                    <span className="text-xs font-medium text-foreground">
                      {api.authentication}
                    </span>
                  </div>
                )}
                {api.requestBody && (
                  <div>
                    <span className="text-xs text-muted-foreground block mb-1">
                      Request Body:
                    </span>
                    <pre className="text-xs bg-muted/50 p-2 rounded overflow-x-auto">
                      {JSON.stringify(api.requestBody, null, 2)}
                    </pre>
                  </div>
                )}
                {api.responseBody && (
                  <div>
                    <span className="text-xs text-muted-foreground block mb-1">
                      Response ({api.responseBody.statusCode}):
                    </span>
                    <pre className="text-xs bg-muted/50 p-2 rounded overflow-x-auto">
                      {JSON.stringify(api.responseBody, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };

  const renderDatabaseDesign = () => {
    const tables = documents?.databaseDesign || [];
    if (tables.length === 0) {
      return <EmptyState message="此討論未產出資料庫設計" />;
    }

    return (
      <div className="space-y-4">
        {tables.map((table: DatabaseTable, index: number) => (
          <div
            key={index}
            className="border border-border rounded-xl overflow-hidden"
          >
            <button
              onClick={() => toggleExpand(`table-${index}`)}
              className="w-full px-4 py-3 flex items-center justify-between bg-card hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Database className="w-4 h-4 text-muted-foreground" />
                <span className="font-mono font-medium text-foreground">
                  {table.tableName}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  {table.columns?.length || 0} 欄位
                </span>
                {expandedItems.has(`table-${index}`) ? (
                  <ChevronUp className="w-4 h-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                )}
              </div>
            </button>
            {expandedItems.has(`table-${index}`) && (
              <div className="px-4 py-3 bg-muted/20 border-t border-border">
                {table.description && (
                  <p className="text-sm text-muted-foreground mb-3">
                    {table.description}
                  </p>
                )}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-2 px-2 text-muted-foreground font-medium">
                          欄位
                        </th>
                        <th className="text-left py-2 px-2 text-muted-foreground font-medium">
                          類型
                        </th>
                        <th className="text-left py-2 px-2 text-muted-foreground font-medium">
                          屬性
                        </th>
                        <th className="text-left py-2 px-2 text-muted-foreground font-medium">
                          說明
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {table.columns?.map((col, colIndex) => (
                        <tr
                          key={colIndex}
                          className="border-b border-border/50"
                        >
                          <td className="py-2 px-2 font-mono text-foreground">
                            {col.name}
                          </td>
                          <td className="py-2 px-2 text-muted-foreground">
                            {col.type}
                          </td>
                          <td className="py-2 px-2">
                            <div className="flex gap-1 flex-wrap">
                              {col.primaryKey && (
                                <span className="px-1.5 py-0.5 text-xs bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300 rounded">
                                  PK
                                </span>
                              )}
                              {col.foreignKey && (
                                <span className="px-1.5 py-0.5 text-xs bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 rounded">
                                  FK
                                </span>
                              )}
                              {!col.nullable && (
                                <span className="px-1.5 py-0.5 text-xs bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 rounded">
                                  NOT NULL
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-2 px-2 text-muted-foreground text-xs">
                            {col.description}
                            {col.foreignKey && (
                              <span className="block text-blue-600 dark:text-blue-400">
                                → {col.foreignKey.table}.{col.foreignKey.column}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {table.indexes && table.indexes.length > 0 && (
                  <div className="mt-3">
                    <span className="text-xs text-muted-foreground">
                      索引:{" "}
                    </span>
                    <span className="text-xs font-mono text-foreground">
                      {table.indexes.join(", ")}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };

  const renderDiagrams = () => {
    const diagramEntries = diagrams
      ? Object.entries(diagrams).filter(
          ([_, diagram]) => diagram !== null && diagram !== undefined
        )
      : [];

    if (diagramEntries.length === 0) {
      return <EmptyState message="此討論未產出圖表" />;
    }

    return (
      <div className="space-y-6">
        {diagramEntries.map(([key, diagram]) => {
          const d = diagram as MermaidDiagram;
          return (
            <MermaidRenderer
              key={key}
              code={d.code}
              title={d.title}
              description={d.description}
            />
          );
        })}
      </div>
    );
  };

  const renderDecisions = () => {
    const decisions = documents?.technicalDecisions || [];
    if (decisions.length === 0) {
      return <EmptyState message="此討論未記錄技術決策" />;
    }

    return (
      <div className="space-y-4">
        {decisions.map((decision: TechnicalDecision, index: number) => (
          <div
            key={decision.id || index}
            className="border border-border rounded-xl overflow-hidden"
          >
            <button
              onClick={() => toggleExpand(`decision-${index}`)}
              className="w-full px-4 py-3 flex items-center justify-between bg-card hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono text-muted-foreground">
                  {decision.id}
                </span>
                <span className="font-medium text-foreground">
                  {decision.title}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`px-2 py-0.5 text-xs font-medium rounded-full ${getStatusColor(
                    decision.status
                  )}`}
                >
                  {decision.status === "accepted"
                    ? "已接受"
                    : decision.status === "proposed"
                    ? "提議中"
                    : "已棄用"}
                </span>
                {expandedItems.has(`decision-${index}`) ? (
                  <ChevronUp className="w-4 h-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                )}
              </div>
            </button>
            {expandedItems.has(`decision-${index}`) && (
              <div className="px-4 py-3 bg-muted/20 border-t border-border space-y-3">
                <div>
                  <span className="text-sm font-medium text-muted-foreground">
                    背景
                  </span>
                  <p className="text-foreground mt-1">{decision.context}</p>
                </div>
                <div>
                  <span className="text-sm font-medium text-muted-foreground">
                    決策
                  </span>
                  <p className="text-foreground mt-1">{decision.decision}</p>
                </div>
                <div>
                  <span className="text-sm font-medium text-muted-foreground">
                    影響
                  </span>
                  <p className="text-foreground mt-1">
                    {decision.consequences}
                  </p>
                </div>
                {decision.alternatives && decision.alternatives.length > 0 && (
                  <div>
                    <span className="text-sm font-medium text-muted-foreground">
                      替代方案
                    </span>
                    <ul className="list-disc list-inside mt-1 space-y-1">
                      {decision.alternatives.map((alt, i) => (
                        <li key={i} className="text-sm text-foreground">
                          {alt}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case "stories":
        return renderUserStories();
      case "api":
        return renderAPIDesign();
      case "db":
        return renderDatabaseDesign();
      case "diagrams":
        return renderDiagrams();
      case "decisions":
        return renderDecisions();
      default:
        return null;
    }
  };

  return (
    <div className="space-y-4">
      {/* Metadata Header */}
      {metadata && (
        <div className="p-4 bg-card rounded-xl border border-border">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              {metadata.projectName && (
                <h3 className="font-semibold text-foreground">
                  {metadata.projectName}
                </h3>
              )}
              <span className="text-sm text-muted-foreground">
                {metadata.discussionDate}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {onExportMarkdown && (
                <Button variant="outline" size="sm" onClick={onExportMarkdown}>
                  <Download className="w-4 h-4 mr-1" />
                  Markdown
                </Button>
              )}
              {onExportJSON && (
                <Button variant="outline" size="sm" onClick={onExportJSON}>
                  <Download className="w-4 h-4 mr-1" />
                  JSON
                </Button>
              )}
            </div>
          </div>
          {metadata.summary && (
            <p className="text-sm text-muted-foreground">{metadata.summary}</p>
          )}
          {metadata.participants && metadata.participants.length > 0 && (
            <div className="flex items-center gap-2 mt-2">
              <Users className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                {metadata.participants.join("、")}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex gap-1 p-1 bg-muted/30 rounded-xl overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap
              ${
                activeTab === tab.id
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }
            `}
          >
            {tab.icon}
            <span>{tab.label}</span>
            {tab.count !== undefined && tab.count > 0 && (
              <span
                className={`
                px-1.5 py-0.5 text-xs rounded-full
                ${
                  activeTab === tab.id
                    ? "bg-primary/10 text-primary"
                    : "bg-muted text-muted-foreground"
                }
              `}
              >
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="min-h-[300px]">{renderTabContent()}</div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <AlertCircle className="w-10 h-10 text-muted-foreground/50 mb-3" />
      <p className="text-muted-foreground">{message}</p>
    </div>
  );
}
