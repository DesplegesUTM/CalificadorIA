'use strict';

// ============================================================
// EvaluadorIA - Frontend JavaScript
// ============================================================

// ---- Toast Notifications ----
(function () {
  const container = document.createElement('div');
  container.id = 'toast-container';
  document.body.appendChild(container);

  window.showToast = function (message, type = 'success', duration = 4000) {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
      <span>${type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ'}</span>
      <span class="flex-1">${message}</span>
      <button type="button" style="opacity:0.5">✕</button>
    `;
    toast.querySelector('button').addEventListener('click', () => toast.remove());
    container.appendChild(toast);
    setTimeout(() => toast.style.opacity = '0', duration - 300);
    setTimeout(() => toast.remove(), duration);
  };
})();

// ---- Auto-dismiss flash messages ----
document.querySelectorAll('.flash-msg').forEach(el => {
  setTimeout(() => {
    el.style.transition = 'opacity 0.5s';
    el.style.opacity = '0';
    setTimeout(() => el.remove(), 500);
  }, 5000);
});

document.addEventListener('click', (event) => {
  const button = event.target.closest('[data-dismiss-flash]');
  if (button) button.parentElement.remove();
});

document.querySelectorAll('[data-import-context]').forEach(button => {
  button.addEventListener('click', () => {
    const fields = [
      ['description', button.dataset.description],
      ['objectives', button.dataset.objectives],
      ['instructions', button.dataset.instructions],
    ].filter(([, value]) => value && value.trim());

    if (fields.length === 0) {
      showToast('La actividad no tiene descripción, objetivos ni instrucciones para importar.', 'info');
      return;
    }

    const replacesExisting = fields.some(([id, value]) => {
      const field = document.getElementById(id);
      return field && field.value.trim() && field.value !== value;
    });
    if (replacesExisting && !confirm('Los campos con información se reemplazarán con los datos de la actividad. ¿Continuar?')) return;

    fields.forEach(([id, value]) => {
      document.getElementById(id).value = value;
    });
    showToast(`Se importaron ${fields.length} campos de la actividad.`);
  });
});

// ---- Confirm Delete ----
window.confirmDelete = function (url, message = '¿Está seguro de eliminar este elemento?') {
  if (!confirm(message)) return;
  fetch(url, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
  })
    .then(r => r.json())
    .then(data => {
      if (data.success) {
        showToast('Eliminado correctamente');
        setTimeout(() => window.location.reload(), 800);
      } else {
        showToast(data.error || 'Error al eliminar', 'error');
      }
    })
    .catch(() => showToast('Error de conexión', 'error'));
};

// ---- Evaluate Submission ----
window.evaluateSubmission = async function (submissionId, btn) {
  if (!confirm('¿Evaluar esta entrega con IA? El proceso puede tardar unos segundos.')) return;

  const originalHTML = btn.innerHTML;
  btn.innerHTML = '<span class="spinner"></span> Evaluando...';
  btn.disabled = true;

  try {
    const res = await fetch(`/evaluaciones/evaluar/${submissionId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    const data = await res.json();

    if (data.success) {
      showToast(`Evaluación completada. Nota: ${data.totalScore}`);
      setTimeout(() => window.location.reload(), 1000);
    } else {
      showToast(data.error || 'Error en la evaluación', 'error');
      btn.innerHTML = originalHTML;
      btn.disabled = false;
    }
  } catch (err) {
    showToast('Error de conexión con el servidor', 'error');
    btn.innerHTML = originalHTML;
    btn.disabled = false;
  }
};

// ---- Evaluate Batch ----
window.evaluateBatch = async function (submissionIds, btn) {
  if (!confirm(`¿Evaluar ${submissionIds.length} entregas? Este proceso puede tardar varios minutos.`)) return;

  const originalHTML = btn?.innerHTML;
  const progress = document.getElementById('batch-evaluation-progress');
  const progressMessage = document.getElementById('batch-evaluation-message');
  const progressCount = document.getElementById('batch-evaluation-count');
  const progressBar = document.getElementById('batch-evaluation-bar');

  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Iniciando evaluación...';
  }
  if (progress) progress.classList.remove('hidden');
  if (progressMessage) progressMessage.textContent = 'Iniciando evaluaciones con IA...';
  if (progressCount) progressCount.textContent = `0 de ${submissionIds.length}`;

  try {
    const res = await fetch('/evaluaciones/evaluar-lote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ submissionIds }),
    });
    const data = await res.json();

    if (data.success) {
      if (btn) btn.innerHTML = '<span class="spinner"></span> Evaluando...';
      const pollBatchStatus = async () => {
        try {
          const statusResponse = await fetch(`/evaluaciones/lote/${encodeURIComponent(data.jobId)}`, {
            headers: { Accept: 'application/json' },
          });
          const statusData = await statusResponse.json();
          if (!statusResponse.ok || !statusData.success) {
            throw new Error(statusData.error || 'No se pudo consultar el progreso');
          }

          const percent = statusData.total ? Math.round((statusData.completed / statusData.total) * 100) : 100;
          if (progressMessage) {
            progressMessage.textContent = statusData.status === 'completed'
              ? `Evaluación finalizada: ${statusData.succeeded} correctas, ${statusData.failed} con error.`
              : statusData.currentSubmissionId
                ? `Evaluando entrega ${statusData.current} de ${statusData.total}...`
                : statusData.completed
                  ? `Evaluadas ${statusData.completed} de ${statusData.total}; iniciando la siguiente...`
                  : 'Preparando evaluaciones...';
          }
          if (progressCount) progressCount.textContent = `${statusData.completed} de ${statusData.total}`;
          if (progressBar) progressBar.style.width = `${percent}%`;

          if (statusData.status === 'completed') {
            showToast(`Evaluación finalizada: ${statusData.succeeded} correctas, ${statusData.failed} con error.`, statusData.failed ? 'info' : 'success');
            setTimeout(() => window.location.reload(), 1200);
            return;
          }
          if (statusData.status === 'failed') {
            throw new Error(statusData.error || 'El proceso masivo no pudo completarse');
          }
          setTimeout(pollBatchStatus, 1500);
        } catch (err) {
          showToast(err.message || 'No se pudo consultar el progreso de las evaluaciones', 'error');
          if (btn) {
            btn.innerHTML = originalHTML;
            btn.disabled = false;
          }
        }
      };
      pollBatchStatus();
    } else {
      showToast(data.error || 'Error', 'error');
      if (btn) {
        btn.innerHTML = originalHTML;
        btn.disabled = false;
      }
      if (progress) progress.classList.add('hidden');
    }
  } catch (err) {
    showToast('Error de conexión al iniciar la evaluación masiva', 'error');
    if (btn) {
      btn.innerHTML = originalHTML;
      btn.disabled = false;
    }
    if (progress) progress.classList.add('hidden');
  }
};

window.reevaluateSubmission = async function (submissionId, button) {
  if (!confirm('¿Desea re-evaluar esta entrega con IA?')) return;
  const original = button.textContent;
  button.disabled = true;
  button.textContent = 'Re-evaluando...';
  try {
    const response = await fetch(`/evaluaciones/reevaluar/${submissionId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    const data = await response.json();
    if (data.success) {
      window.location.href = `/evaluaciones/${data.evaluationId}`;
    } else {
      showToast(data.error || 'No se pudo re-evaluar', 'error');
      button.disabled = false;
      button.textContent = original;
    }
  } catch (err) {
    showToast('Error de conexión', 'error');
    button.disabled = false;
    button.textContent = original;
  }
};

// ---- Drag and Drop Upload ----
document.querySelectorAll('.upload-zone').forEach(zone => {
  zone.addEventListener('dragover', (e) => {
    e.preventDefault();
    zone.classList.add('drag-over');
  });
  zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) {
      const input = zone.querySelector('input[type="file"]');
      if (input) {
        const dt = new DataTransfer();
        dt.items.add(file);
        input.files = dt.files;
        zone.querySelector('.upload-filename') && (zone.querySelector('.upload-filename').textContent = file.name);
      }
    }
  });
  zone.addEventListener('click', () => zone.querySelector('input[type="file"]')?.click());
});

// ---- Toggle User Active ----
window.toggleUser = async function (userId, btn) {
  const res = await fetch(`/admin/usuarios/${userId}/toggle`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
  });
  const data = await res.json();
  if (data.success) {
    showToast(data.active ? 'Usuario activado' : 'Usuario desactivado');
    setTimeout(() => window.location.reload(), 800);
  } else {
    showToast(data.error || 'Error', 'error');
  }
};

// ---- Test AI Connection ----
window.testAIConnection = async function (provider, apiKey, model, statusEl) {
  if (statusEl) statusEl.innerHTML = '<span class="spinner"></span> Probando...';
  
  const res = await fetch('/admin/configuracion-ia/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider, apiKey, model }),
  });
  const data = await res.json();

  if (statusEl) {
    statusEl.innerHTML = data.valid
      ? `<span class="text-green-600">✓ ${data.message}</span>`
      : `<span class="text-red-600">✕ ${data.message}</span>`;
  }
  showToast(data.message, data.valid ? 'success' : 'error');
};

// ---- Format dates ----
document.querySelectorAll('[data-date]').forEach(el => {
  const date = new Date(el.dataset.date);
  el.textContent = date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
});

document.querySelectorAll('[data-evaluate-submission]').forEach(button => {
  button.addEventListener('click', () => {
    window.evaluateSubmission(button.dataset.evaluateSubmission, button);
  });
});

document.querySelectorAll('[data-evaluate-batch]').forEach(button => {
  button.addEventListener('click', () => {
    const submissionIds = button.dataset.evaluateBatch.split(',').filter(Boolean).map(Number);
    if (submissionIds.length === 0) {
      showToast('No hay entregas pendientes para evaluar', 'info');
      return;
    }
    window.evaluateBatch(submissionIds, button);
  });
});

document.querySelectorAll('[data-reevaluate-submission]').forEach(button => {
  button.addEventListener('click', () => {
    window.reevaluateSubmission(button.dataset.reevaluateSubmission, button);
  });
});

document.querySelectorAll('[data-delete-submission]').forEach(button => {
  button.addEventListener('click', () => {
    const submissionId = button.dataset.deleteSubmission;
    confirmDelete(`/entregas/${submissionId}`, '¿Eliminar esta entrega y sus evaluaciones?');
  });
});
