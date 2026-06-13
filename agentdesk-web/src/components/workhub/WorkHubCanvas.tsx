import { useCallback, useEffect, useMemo, useState } from "react";

import {

  ReactFlow,

  ReactFlowProvider,

  Background,

  Controls,

  MiniMap,

  ConnectionMode,

  useEdgesState,

  useNodesState,

  useReactFlow,

  type Connection,

  type Node,

  type OnConnect,

  type OnEdgesDelete,

  type OnNodeDrag,

  type NodeMouseHandler,

} from "@xyflow/react";

import "@xyflow/react/dist/style.css";

import type { WorkHub, WorkProject } from "../../lib/api";

import {

  ACTIVITY_DROP_ZONE_TOP,

  PROJECT_DROP_ZONE_TOP,

  buildWorkGraph,

  getActivityIdFromNode,

  getProjectIdFromNode,

  getTaskIdFromNode,

  parseNodeSelection,

  resolveWorkConnection,

  resolveWorkEdgeRemoval,

  isValidWorkConnection,

  type WorkNodeData,

  type WorkNodeSelection,

} from "./workHubGraph";

import type { CanvasNestState } from "./workHubCanvasLayout";

import { ActivityContainerNode } from "./ActivityContainerNode";

import { ProjectContainerNode } from "./ProjectContainerNode";

import { WorkNode } from "./WorkNode";

import { WorkNodeContextMenu } from "./WorkNodeContextMenu";

import { WorkCanvasContextMenu } from "./WorkCanvasContextMenu";

import { WorkGradientEdge } from "./WorkGradientEdge";

import { NODE_KIND_META } from "./workNodeStyles";

import type { Agent } from "../../lib/api";

import type { WorkItemKind } from "../workspace/WorkItemModal";



const nodeTypes = {

  projectContainer: ProjectContainerNode,

  activityContainer: ActivityContainerNode,

  taskNode: WorkNode,

};



const edgeTypes = {

  workGradient: WorkGradientEdge,

};



function nodeSize(node: Node<WorkNodeData>) {

  const w = Number(node.style?.width ?? node.data.containerWidth ?? 200);

  const h = Number(node.style?.height ?? node.data.containerHeight ?? 80);

  return { w, h };

}



function nodePosition(node: Node<WorkNodeData>) {

  const abs = (node as Node<WorkNodeData> & { positionAbsolute?: { x: number; y: number } })

    .positionAbsolute;

  return abs ?? node.position;

}



function nodeCenter(node: Node<WorkNodeData>) {

  const pos = nodePosition(node);

  const { w, h } = nodeSize(node);

  return { x: pos.x + w / 2, y: pos.y + h / 2 };

}



function isInsideDropZone(

  dragged: Node<WorkNodeData>,

  container: Node<WorkNodeData>,

  dropZoneTop: number

) {

  const center = nodeCenter(dragged);

  const pos = nodePosition(container);

  const { w, h } = nodeSize(container);

  return (

    center.x >= pos.x + 8 &&

    center.x <= pos.x + w - 8 &&

    center.y >= pos.y + dropZoneTop &&

    center.y <= pos.y + h - 8

  );

}



type CanvasProps = {

  hub: WorkHub;

  filterProjectId: string | null;

  nestState: CanvasNestState;

  onSelectNode: (node: Node<WorkNodeData> | null) => void;

  selectedNodeId: string | null;

  onNestTask: (taskId: string, activityId: string) => void;

  onUnnestTask: (taskId: string) => void;

  onNestActivity: (activityId: string, projectId: string) => void;

  onUnnestActivity: (activityId: string) => void;

  onConnectActivity: (activityId: string, projectId: string) => void;

  onConnectTask: (taskId: string, activityId: string) => void;

  onDisconnectActivity: (activityId: string, projectId: string) => void;

  onDisconnectTask: (taskId: string) => void;

  onCreateCard: (kind: WorkItemKind) => void;

  agents: Agent[];

  onAgentChange: (selection: WorkNodeSelection, agentId: string | null) => void;

  onProjectAgentAdd: (project: WorkProject, agentId: string) => void;

  onProjectAgentRemove: (project: WorkProject, agentId: string) => void;

  onEditSelection: (selection: WorkNodeSelection) => void;

  onDeleteSelection: (selection: WorkNodeSelection) => void;

  onStatusChange: (selection: WorkNodeSelection, status: string) => void;

  onPriorityChange: (selection: WorkNodeSelection, priority: string) => void;

};



function CanvasFlow({

  hub,

  filterProjectId,

  nestState,

  onSelectNode,

  selectedNodeId,

  onNestTask,

  onUnnestTask,

  onNestActivity,

  onUnnestActivity,

  onConnectActivity,

  onConnectTask,

  onDisconnectActivity,

  onDisconnectTask,

  onCreateCard,

  agents,

  onAgentChange,

  onProjectAgentAdd,

  onProjectAgentRemove,

  onEditSelection,

  onDeleteSelection,

  onStatusChange,

  onPriorityChange,

}: CanvasProps) {

  const { getIntersectingNodes } = useReactFlow();

  const graph = useMemo(

    () => buildWorkGraph(hub, nestState, filterProjectId),

    [hub, nestState, filterProjectId]

  );



  const [nodes, setNodes, onNodesChange] = useNodesState(graph.nodes);

  const [edges, setEdges, onEdgesChange] = useEdgesState(graph.edges);

  const [contextMenu, setContextMenu] = useState<{

    selection: WorkNodeSelection;

    position: { x: number; y: number };

  } | null>(null);

  const [canvasMenu, setCanvasMenu] = useState<{ x: number; y: number } | null>(null);



  useEffect(() => {

    setNodes(graph.nodes);

    setEdges(graph.edges);

  }, [graph, setNodes, setEdges]);



  useEffect(() => {

    setNodes((current) =>

      current.map((node) => ({

        ...node,

        selected: node.id === selectedNodeId,

      }))

    );

  }, [selectedNodeId, setNodes]);



  const clearDropTargets = useCallback(() => {

    setNodes((nds) =>

      nds.map((n) => ({

        ...n,

        data: { ...n.data, isDropTarget: false },

      }))

    );

  }, [setNodes]);



  const onNodeDrag: OnNodeDrag<Node<WorkNodeData>> = useCallback(

    (_event, dragged) => {

      if (dragged.parentId) {

        const parent = nodes.find((n) => n.id === dragged.parentId);

        if (parent) {

          const dropTop =

            parent.data.kind === "project" ? PROJECT_DROP_ZONE_TOP : ACTIVITY_DROP_ZONE_TOP;

          setNodes((nds) =>

            nds.map((n) => ({

              ...n,

              data: {

                ...n.data,

                isDropTarget: n.id === parent.id && isInsideDropZone(dragged, parent, dropTop),

              },

            }))

          );

          return;

        }

      }



      const hits = getIntersectingNodes(dragged);

      const activityHits = hits.filter((n) => n.data.kind === "activity");

      const projectHits = hits.filter((n) => n.data.kind === "project");



      setNodes((nds) =>

        nds.map((n) => ({

          ...n,

          data: {

            ...n.data,

            isDropTarget:

              (dragged.data.kind === "task" &&

                n.data.kind === "activity" &&

                activityHits.some((h) => h.id === n.id) &&

                isInsideDropZone(dragged, n as Node<WorkNodeData>, ACTIVITY_DROP_ZONE_TOP)) ||

              (dragged.data.kind === "activity" &&

                n.data.kind === "project" &&

                projectHits.some((h) => h.id === n.id) &&

                isInsideDropZone(dragged, n as Node<WorkNodeData>, PROJECT_DROP_ZONE_TOP)),

          },

        }))

      );

    },

    [getIntersectingNodes, nodes, setNodes]

  );



  const onNodeDragStop: OnNodeDrag<Node<WorkNodeData>> = useCallback(

    (_event, dragged) => {

      clearDropTargets();



      if (dragged.data.kind === "task") {

        const taskId = getTaskIdFromNode(dragged);

        if (!taskId) return;



        if (dragged.parentId) {

          const parent = nodes.find((n) => n.id === dragged.parentId);

          if (

            parent &&

            !isInsideDropZone(dragged, parent as Node<WorkNodeData>, ACTIVITY_DROP_ZONE_TOP)

          ) {

            onUnnestTask(taskId);

          }

          return;

        }



        const activityHits = getIntersectingNodes(dragged).filter((n) => n.data.kind === "activity");

        for (const hit of activityHits) {

          if (isInsideDropZone(dragged, hit as Node<WorkNodeData>, ACTIVITY_DROP_ZONE_TOP)) {

            const activityId = getActivityIdFromNode(hit as Node<WorkNodeData>);

            if (activityId) onNestTask(taskId, activityId);

            return;

          }

        }

        return;

      }



      if (dragged.data.kind === "activity") {

        const activityId = getActivityIdFromNode(dragged);

        if (!activityId) return;



        if (dragged.parentId) {

          const parent = nodes.find((n) => n.id === dragged.parentId);

          if (

            parent &&

            !isInsideDropZone(dragged, parent as Node<WorkNodeData>, PROJECT_DROP_ZONE_TOP)

          ) {

            onUnnestActivity(activityId);

          }

          return;

        }



        const projectHits = getIntersectingNodes(dragged).filter((n) => n.data.kind === "project");

        for (const hit of projectHits) {

          if (isInsideDropZone(dragged, hit as Node<WorkNodeData>, PROJECT_DROP_ZONE_TOP)) {

            const projectId = getProjectIdFromNode(hit as Node<WorkNodeData>);

            if (projectId) onNestActivity(activityId, projectId);

            return;

          }

        }

      }

    },

    [

      clearDropTargets,

      getIntersectingNodes,

      nodes,

      onNestTask,

      onUnnestTask,

      onNestActivity,

      onUnnestActivity,

    ]

  );



  const onNodeContextMenu: NodeMouseHandler = useCallback((event, node) => {

    event.preventDefault();

    const selection = parseNodeSelection(node as Node<WorkNodeData>);

    if (!selection) return;

    onSelectNode(node as Node<WorkNodeData>);

    setContextMenu({

      selection,

      position: { x: event.clientX, y: event.clientY },

    });

  }, [onSelectNode]);



  const isValidConnection = useCallback(

    (connection: Connection | { source: string | null; target: string | null }) => {

      if (!connection.source || !connection.target) return false;

      if (connection.source === connection.target) return false;

      const sourceNode = nodes.find((n) => n.id === connection.source);

      const targetNode = nodes.find((n) => n.id === connection.target);

      if (!sourceNode || !targetNode) return false;

      if (sourceNode.parentId || targetNode.parentId) return false;

      return isValidWorkConnection(sourceNode.data.kind, targetNode.data.kind);

    },

    [nodes]

  );



  const onConnect: OnConnect = useCallback(

    (connection) => {

      const sourceNode = nodes.find((n) => n.id === connection.source);

      const targetNode = nodes.find((n) => n.id === connection.target);

      if (!sourceNode || !targetNode) return;



      const action = resolveWorkConnection(

        sourceNode as Node<WorkNodeData>,

        targetNode as Node<WorkNodeData>

      );

      if (!action) return;



      if (action.type === "connect-activity") {

        onConnectActivity(action.activityId, action.projectId);

      } else if (action.type === "connect-task") {

        onConnectTask(action.taskId, action.activityId);

      }

    },

    [nodes, onConnectActivity, onConnectTask]

  );



  const onEdgesDelete: OnEdgesDelete = useCallback(

    (deleted) => {

      for (const edge of deleted) {

        const sourceNode = nodes.find((n) => n.id === edge.source);

        const targetNode = nodes.find((n) => n.id === edge.target);

        if (!sourceNode || !targetNode) continue;



        const action = resolveWorkEdgeRemoval(

          sourceNode as Node<WorkNodeData>,

          targetNode as Node<WorkNodeData>

        );

        if (!action) continue;



        if (action.type === "disconnect-activity") {

          onDisconnectActivity(action.activityId, action.projectId);

        } else if (action.type === "disconnect-task") {

          onDisconnectTask(action.taskId);

        }

      }

    },

    [nodes, onDisconnectActivity, onDisconnectTask]

  );



  return (

    <>

      <ReactFlow

        nodes={nodes}

        edges={edges}

        onNodesChange={onNodesChange}

        onEdgesChange={onEdgesChange}

        nodeTypes={nodeTypes}

        edgeTypes={edgeTypes}

        defaultEdgeOptions={{ type: "workGradient" }}

        elevateEdgesOnSelect

        connectionMode={ConnectionMode.Loose}

        nodesConnectable

        elementsSelectable

        edgesReconnectable

        deleteKeyCode={["Backspace", "Delete"]}

        isValidConnection={isValidConnection}

        onConnect={onConnect}

        onEdgesDelete={onEdgesDelete}

        connectionLineStyle={{ stroke: "#2dd4bf", strokeWidth: 2.5 }}

        fitView

        fitViewOptions={{ padding: 0.2 }}

        minZoom={0.3}

        maxZoom={1.5}

        proOptions={{ hideAttribution: true }}

        onNodeClick={(_, node) => {

          setContextMenu(null);

          setCanvasMenu(null);

          onSelectNode(node as Node<WorkNodeData>);

        }}

        onPaneClick={() => {

          setContextMenu(null);

          setCanvasMenu(null);

          onSelectNode(null);

        }}

        onPaneContextMenu={(event) => {

          event.preventDefault();

          setContextMenu(null);

          setCanvasMenu({ x: event.clientX, y: event.clientY });

        }}

        onNodeContextMenu={onNodeContextMenu}

        onNodeDrag={onNodeDrag}

        onNodeDragStop={onNodeDragStop}

        className="work-hub-flow"

      >

        <Background gap={20} size={1} color="#1f1f1f" />

        <Controls

          showInteractive={false}

          className="!rounded-xl !border-border !bg-panel-elevated !shadow-none [&>button]:!border-border [&>button]:!bg-panel [&>button]:!fill-text-muted"

        />

        <MiniMap

          nodeColor={(n) => {

            const kind = (n.data as WorkNodeData)?.kind;

            if (kind === "project") return NODE_KIND_META.project.edgeColor;

            if (kind === "activity") return NODE_KIND_META.activity.edgeColor;

            return NODE_KIND_META.task.edgeColor;

          }}

          maskColor="rgba(0,0,0,0.65)"

          className="!rounded-xl !border-border !bg-panel"

        />

      </ReactFlow>



      {canvasMenu && (

        <WorkCanvasContextMenu

          position={canvasMenu}

          onClose={() => setCanvasMenu(null)}

          onCreate={onCreateCard}

        />

      )}



      {contextMenu && (

        <WorkNodeContextMenu

          selection={contextMenu.selection}

          position={contextMenu.position}

          agents={agents}

          onClose={() => setContextMenu(null)}

          onEdit={() => onEditSelection(contextMenu.selection)}

          onDelete={() => onDeleteSelection(contextMenu.selection)}

          onStatusChange={(status) => onStatusChange(contextMenu.selection, status)}

          onPriorityChange={(priority) => onPriorityChange(contextMenu.selection, priority)}

          onAgentChange={(agentId) => onAgentChange(contextMenu.selection, agentId)}

          onProjectAgentAdd={(agentId) => {

            const project = contextMenu.selection.item as WorkProject;

            onProjectAgentAdd(project, agentId);

          }}

          onProjectAgentRemove={(agentId) => {

            const project = contextMenu.selection.item as WorkProject;

            onProjectAgentRemove(project, agentId);

          }}

        />

      )}

    </>

  );

}



export function WorkHubCanvas(props: CanvasProps) {

  return (

    <div className="h-full min-h-[480px] w-full rounded-2xl border border-border bg-[#0a0a0a]">

      <ReactFlowProvider>

        <CanvasFlow {...props} />

      </ReactFlowProvider>

    </div>

  );

}


