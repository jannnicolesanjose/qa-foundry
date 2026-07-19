(function () {
  const $ = (s) => document.querySelector(s);
  const STATUSES = [
    { key: "todo", label: "To Do", color: "#9CA3AF" },
    { key: "inprogress", label: "In Progress", color: "#8FB4D9" },
    { key: "retest", label: "Retest", color: "#E8B86A" },
    { key: "open", label: "Open", color: "#E8A6A0" },
    { key: "done", label: "Done", color: "#8FB89A" },
    { key: "closed", label: "Closed", color: "#4A423E" },
  ];

  let todos = [];
  let editingId = null;
  let pendingAttachment = null;

  async function refresh() {
    todos = await QAFDB.getAll("todos");
    renderSprintFilter();
    renderBoard();
  }

  function renderSprintFilter() {
    const sel = $("#filter-sprint");
    const current = sel.value;
    const sprints = [...new Set(todos.map((t) => t.sprint).filter(Boolean))].sort();
    sel.innerHTML = `<option value="">All sprints</option>` + sprints.map((s) => `<option>${escapeHtml(s)}</option>`).join("");
    sel.value = sprints.includes(current) ? current : "";
  }

  function renderBoard() {
    const search = ($("#task-search").value || "").toLowerCase();
    const sprintFilter = $("#filter-sprint").value;
    let filtered = todos;
    if (search) filtered = filtered.filter((t) => t.title.toLowerCase().includes(search));
    if (sprintFilter) filtered = filtered.filter((t) => t.sprint === sprintFilter);

    const board = $("#board-scroll");
    board.innerHTML = STATUSES.map((s) => {
      const items = filtered.filter((t) => t.status === s.key).sort((a, b) => b.updatedAt - a.updatedAt);
      return `
      <div class="board-col" data-status="${s.key}">
        <div class="board-col-head">
          <span class="col-title"><span class="status-dot" style="background:${s.color}"></span>${s.label}</span>
          <span class="col-count">${items.length}</span>
        </div>
        <div class="col-cards" data-status-drop="${s.key}">
          ${items.map((t) => taskCardHTML(t)).join("")}
        </div>
      </div>`;
    }).join("");

    board.querySelectorAll(".task-card").forEach((card) => {
      card.addEventListener("click", () => openTaskModal(card.dataset.id));
      card.addEventListener("dragstart", (e) => { card.classList.add("dragging"); e.dataTransfer.setData("text/plain", card.dataset.id); });
      card.addEventListener("dragend", () => card.classList.remove("dragging"));
    });

    board.querySelectorAll(".board-col").forEach((col) => {
      col.addEventListener("dragover", (e) => { e.preventDefault(); col.classList.add("drag-over"); });
      col.addEventListener("dragleave", () => col.classList.remove("drag-over"));
      col.addEventListener("drop", async (e) => {
        e.preventDefault();
        col.classList.remove("drag-over");
        const id = e.dataTransfer.getData("text/plain");
        const task = todos.find((t) => t.id === id);
        if (!task) return;
        task.status = col.dataset.status;
        task.updatedAt = Date.now();
        await QAFDB.put("todos", task);
        refresh();
      });
    });
  }

  function taskCardHTML(t) {
    const priClass = (t.priority === "High" || t.priority === "Critical") ? "priority-high" : "";
    return `
    <div class="task-card" draggable="true" data-id="${t.id}">
      <div class="tc-title">${escapeHtml(t.title)}</div>
      <div class="tc-meta">
        <span class="tc-tag ${priClass}">${escapeHtml(t.priority || "Medium")}</span>
        ${t.sprint ? `<span class="tc-tag">${escapeHtml(t.sprint)}</span>` : ""}
        ${t.environment ? `<span class="tc-tag">${escapeHtml(t.environment)}</span>` : ""}
        ${(t.comments || []).length ? `<span class="tc-tag">💬 ${t.comments.length}</span>` : ""}
      </div>
    </div>`;
  }

  function populateParentOptions(excludeId) {
    const sel = $("#input-task-parent");
    sel.innerHTML = `<option value="">— None —</option>` +
      todos.filter((t) => t.id !== excludeId).map((t) => `<option value="${t.id}">${escapeHtml(t.title)}</option>`).join("");
  }

  function openTaskModal(id) {
    editingId = id || null;
    pendingAttachment = null;
    $("#comment-attach-name").textContent = "";
    populateParentOptions(editingId);
    QAFValidate.clearFieldError($("#field-task-title"));

    if (editingId) {
      const t = todos.find((x) => x.id === editingId);
      $("#task-modal-title").textContent = "Edit task";
      $("#input-task-title").value = t.title;
      $("#input-task-desc").value = t.description || "";
      $("#input-task-status").value = t.status;
      $("#input-task-priority").value = t.priority || "Medium";
      $("#input-task-parent").value = t.parent || "";
      $("#input-task-sprint").value = t.sprint || "";
      $("#input-task-env").value = t.environment || "Local";
      $("#input-task-assignee").value = t.assignee || "";
      $("#btn-delete-task").classList.remove("hidden");
      $("#comments-section").classList.remove("hidden");
      renderComments(t);
    } else {
      $("#task-modal-title").textContent = "New task";
      $("#input-task-title").value = "";
      $("#input-task-desc").value = "";
      $("#input-task-status").value = "todo";
      $("#input-task-priority").value = "High";
      $("#input-task-parent").value = "";
      $("#input-task-sprint").value = "";
      $("#input-task-env").value = "Local";
      $("#input-task-assignee").value = localStorage.getItem("qaf-author") || "";
      $("#btn-delete-task").classList.add("hidden");
      $("#comments-section").classList.add("hidden");
    }
    $("#modal-task").hidden = false;
  }

  function renderComments(t) {
    const list = $("#comment-list");
    const comments = t.comments || [];
    if (comments.length === 0) { list.innerHTML = `<p class="text-dim" style="font-size:12px;">No comments yet.</p>`; return; }
    list.innerHTML = "";
    comments.slice().reverse().forEach((c) => {
      const div = document.createElement("div");
      div.className = "comment-item";
      div.innerHTML = `
        <div class="c-head"><span>${escapeHtml(c.author || "Unknown")}</span><span>${QAFValidate.fmtDate(c.timestamp)}</span></div>
        <div class="c-body">${escapeHtml(c.text || "")}</div>
        <div class="comment-attach"></div>`;
      if (c.attachment) {
        const url = URL.createObjectURL(c.attachment);
        const holder = div.querySelector(".comment-attach");
        if (c.attachment.type.startsWith("image/")) {
          const img = document.createElement("img");
          img.src = url; holder.appendChild(img);
        } else if (c.attachment.type.startsWith("video/")) {
          const vid = document.createElement("video");
          vid.src = url; vid.controls = true; holder.appendChild(vid);
        }
      }
      list.appendChild(div);
    });
  }

  $("#comment-attach-input").addEventListener("change", () => {
    const file = $("#comment-attach-input").files[0];
    if (!file) return;
    const errors = QAFValidate.validateFile(file, {
      allowedExt: [...QAFValidate.IMAGE_EXT, ...QAFValidate.VIDEO_EXT],
      maxSizeMB: 50,
    });
    if (errors.length) {
      QAFToast.error(errors[0], "Invalid attachment");
      $("#comment-attach-input").value = "";
      pendingAttachment = null;
      return;
    }
    pendingAttachment = file;
    $("#comment-attach-name").textContent = `${file.name} (${QAFValidate.fmtBytes(file.size)})`;
  });

  $("#btn-add-comment").addEventListener("click", async () => {
    if (!editingId) return;
    const text = $("#new-comment-text").value.trim();
    if (!text && !pendingAttachment) {
      QAFToast.error("Write something or attach a file before posting.", "Empty comment");
      return;
    }
    const t = todos.find((x) => x.id === editingId);
    t.comments = t.comments || [];
    t.comments.push({
      id: QAFDB.uid(),
      text,
      author: localStorage.getItem("qaf-author") || "Unknown",
      timestamp: Date.now(),
      attachment: pendingAttachment || null,
    });
    t.updatedAt = Date.now();
    await QAFDB.put("todos", t);
    $("#new-comment-text").value = "";
    $("#comment-attach-input").value = "";
    $("#comment-attach-name").textContent = "";
    pendingAttachment = null;
    todos = await QAFDB.getAll("todos");
    renderComments(todos.find((x) => x.id === editingId));
    QAFToast.success("Comment posted.");
  });

  $("#save-task").addEventListener("click", async () => {
    const title = $("#input-task-title").value.trim();
    const err = QAFValidate.requireText(title, "Title");
    if (err) { QAFValidate.setFieldError($("#field-task-title"), err); return; }
    const now = Date.now();
    const assignee = $("#input-task-assignee").value.trim();
    if (assignee) localStorage.setItem("qaf-author", assignee);

    const data = {
      title,
      description: $("#input-task-desc").value.trim(),
      status: $("#input-task-status").value,
      priority: $("#input-task-priority").value,
      parent: $("#input-task-parent").value || null,
      sprint: $("#input-task-sprint").value.trim(),
      environment: $("#input-task-env").value,
      assignee,
      updatedAt: now,
    };

    if (editingId) {
      const existing = todos.find((t) => t.id === editingId);
      Object.assign(existing, data);
      await QAFDB.put("todos", existing);
      QAFToast.success("Task updated.");
    } else {
      await QAFDB.put("todos", { id: QAFDB.uid(), ...data, comments: [], createdAt: now });
      QAFToast.success("Task created.");
    }
    $("#modal-task").hidden = true;
    refresh();
  });

  $("#btn-delete-task").addEventListener("click", async () => {
    if (!editingId) return;
    if (!confirm("Delete this task? This can't be undone.")) return;
    await QAFDB.delete("todos", editingId);
    $("#modal-task").hidden = true;
    QAFToast.success("Task deleted.");
    refresh();
  });

  $("#btn-new-task").addEventListener("click", () => openTaskModal(null));
  $("#task-search").addEventListener("input", renderBoard);
  $("#filter-sprint").addEventListener("change", renderBoard);

  document.querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", (e) => {
    e.target.closest(".modal-overlay").hidden = true;
  }));

  refresh();
})();
