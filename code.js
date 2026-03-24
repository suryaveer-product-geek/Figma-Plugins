// Show the plugin UI
figma.showUI(__html__, { width: 480, height: 600, title: "Screen Explainer" });

// Helper: extract a simplified node tree from a frame
function extractNodeTree(node, depth = 0) {
  if (depth > 5) return null; // cap depth to avoid massive trees

  const base = {
    type: node.type,
    name: node.name,
    width: Math.round(node.width),
    height: Math.round(node.height),
    x: Math.round(node.x),
    y: Math.round(node.y),
  };

  // Pull text content
  if (node.type === "TEXT") {
    base.text = node.characters;
    base.fontSize = node.fontSize;
    base.fontWeight = node.fontWeight;
  }

  // Pull fill colors
  if ("fills" in node && node.fills.length > 0) {
    const fill = node.fills[0];
    if (fill.type === "SOLID") {
      const { r, g, b } = fill.color;
      base.fill = `rgb(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)})`;
    }
  }

  // Pull stroke colors
  if ("strokes" in node && node.strokes.length > 0) {
    const stroke = node.strokes[0];
    if (stroke.type === "SOLID") {
      const { r, g, b } = stroke.color;
      base.stroke = `rgb(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)})`;
    }
  }

  // Pull corner radius
  if ("cornerRadius" in node && node.cornerRadius) {
    base.cornerRadius = node.cornerRadius;
  }

  // Recurse into children
  if ("children" in node && node.children.length > 0) {
    const children = node.children
      .map((child) => extractNodeTree(child, depth + 1))
      .filter(Boolean);
    if (children.length > 0) base.children = children;
  }

  return base;
}

// Listen for messages from ui.html
figma.ui.onmessage = async (msg) => {

  // ── ANALYZE: user clicked "Explain This Screen" ──
  if (msg.type === "analyze") {
    const selection = figma.currentPage.selection;

    if (selection.length === 0) {
      figma.ui.postMessage({
        type: "error",
        message: "Nothing selected. Please select a frame or component first.",
      });
      return;
    }

    const node = selection[0];

    // Warn if selection isn't a frame-like node
    if (!["FRAME", "COMPONENT", "GROUP", "SECTION"].includes(node.type)) {
      figma.ui.postMessage({
        type: "error",
        message: `Selected a "${node.type}" — please select a Frame or Component instead.`,
      });
      return;
    }

    try {
      // Export frame as PNG (base64)
      const imageBytes = await node.exportAsync({
        format: "PNG",
        constraint: { type: "SCALE", value: 1 },
      });

      // Convert Uint8Array to base64
      const base64 = figma.base64Encode(imageBytes);

      // Extract node tree
      const nodeTree = extractNodeTree(node);

      // Send both to UI
      figma.ui.postMessage({
        type: "frameData",
        frameName: node.name,
        imageBase64: base64,
        nodeTree: nodeTree,
        frameWidth: Math.round(node.width),
        frameHeight: Math.round(node.height),
      });

    } catch (err) {
      figma.ui.postMessage({
        type: "error",
        message: "Failed to export frame: " + err.message,
      });
    }
  }

  // ── CLOSE: user dismissed the plugin ──
  if (msg.type === "close") {
    figma.closePlugin();
  }
};
