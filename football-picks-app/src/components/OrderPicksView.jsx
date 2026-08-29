import React, { useRef, useEffect, useCallback } from 'react';
import { GripVertical } from 'lucide-react';
import { teamLogoSrc } from '../utils/teamLogos';

/**
 * Order view: rank games by confidence. The top row is worth the most points.
 *
 * Drag implementation notes:
 * - Pointer events (mouse AND touch), not HTML5 drag-and-drop.
 * - Two ways to start a drag:
 *     1. The grip handle: instant (touch-action: none claims the gesture).
 *     2. Anywhere else on the row: press and hold ~250ms without moving.
 *        Moving before the hold completes means the user is scrolling or
 *        tapping a team, so the drag never arms.
 * - While dragging, rows move with direct DOM transforms via refs — React
 *   state is only touched once, on drop. That is what keeps it smooth.
 */

const HOLD_MS = 250;      // press-and-hold delay before a row drag arms
const HOLD_SLOP_PX = 8;   // movement that cancels the pending hold
const ROW_GAP_PX = 10;    // matches .op-list gap below

function OrderPicksView({
  orderedGames,
  totalGames,
  picks,
  readOnly,
  onPick,
  onMove,        // (gameId, fromIndex, toIndex) -> commit a reorder
  hasError,      // (gameId) -> red glow
  isIncomplete,  // (gameId) -> blue glow
}) {
  const rowRefs = useRef(new Map());
  const drag = useRef(null);       // active drag state
  const hold = useRef(null);       // pending press-and-hold state
  const suppressClick = useRef(false);

  const setRowRef = useCallback((id) => (el) => {
    if (el) rowRefs.current.set(id, el);
    else rowRefs.current.delete(id);
  }, []);

  const preventTouchScroll = useCallback((e) => e.preventDefault(), []);

  const clearHold = () => {
    if (hold.current) {
      clearTimeout(hold.current.timer);
      hold.current = null;
    }
  };

  const clearTransforms = () => {
    for (const el of rowRefs.current.values()) {
      el.style.transform = '';
      el.style.transition = '';
      el.style.zIndex = '';
      el.classList.remove('op-row-dragging');
    }
  };

  // Shared by grip (instant) and row (after hold)
  const startDrag = (gameId, index, pointerId, clientY, captureEl) => {
    const row = rowRefs.current.get(gameId);
    if (!row) return;

    try {
      captureEl.setPointerCapture(pointerId);
    } catch {
      /* capture can fail for synthetic events; drag still works via bubbling */
    }

    drag.current = {
      gameId,
      startIndex: index,
      curIndex: index,
      startY: clientY,
      rowH: row.getBoundingClientRect().height + ROW_GAP_PX,
      pointerId,
    };
    row.classList.add('op-row-dragging');
    row.style.zIndex = '5';
    row.style.transition = 'none';
    // Once a drag is armed, the page must not scroll under the finger
    document.addEventListener('touchmove', preventTouchScroll, { passive: false });
    // Safety net: finish the drag even if the row never receives pointerup
    // (gesture stolen by the browser, tab switch, capture lost)
    window.addEventListener('pointerup', onWindowPointerUp);
    window.addEventListener('pointercancel', onWindowPointerCancel);
    window.addEventListener('blur', onWindowBlur);
  };

  const onWindowPointerUp = (e) => {
    if (drag.current && e.pointerId === drag.current.pointerId) endDrag(true);
  };
  const onWindowPointerCancel = (e) => {
    if (drag.current && e.pointerId === drag.current.pointerId) endDrag(false);
  };
  const onWindowBlur = () => {
    if (drag.current) endDrag(false);
  };

  const moveDrag = (clientY) => {
    const d = drag.current;
    if (!d) return;

    const dy = clientY - d.startY;
    const draggedEl = rowRefs.current.get(d.gameId);
    if (draggedEl) draggedEl.style.transform = `translateY(${dy}px)`;

    // Keep the page scrolling when dragging near the viewport edges
    if (clientY < 110) window.scrollBy(0, -8);
    else if (clientY > window.innerHeight - 110) window.scrollBy(0, 8);

    const target = Math.min(
      orderedGames.length - 1,
      Math.max(0, d.startIndex + Math.round(dy / d.rowH))
    );
    if (target === d.curIndex) return;
    d.curIndex = target;

    // Shift the in-between rows out of the way and live-update every points
    // badge to the value it would have after this drop (still no re-render)
    orderedGames.forEach((g, i) => {
      const el = rowRefs.current.get(g.id);
      if (!el) return;
      const badge = el.querySelector('.op-points-num');

      if (g.id === d.gameId) {
        if (badge) badge.textContent = totalGames - target;
        return;
      }

      let shift = 0;
      let newIndex = i;
      if (d.startIndex < target && i > d.startIndex && i <= target) {
        shift = -d.rowH;
        newIndex = i - 1;
      } else if (d.startIndex > target && i >= target && i < d.startIndex) {
        shift = d.rowH;
        newIndex = i + 1;
      }
      el.style.transform = shift ? `translateY(${shift}px)` : '';
      if (badge) badge.textContent = totalGames - newIndex;
    });
  };

  const endDrag = (commit) => {
    const d = drag.current;
    if (!d) return;
    drag.current = null;
    document.removeEventListener('touchmove', preventTouchScroll);
    window.removeEventListener('pointerup', onWindowPointerUp);
    window.removeEventListener('pointercancel', onWindowPointerCancel);
    window.removeEventListener('blur', onWindowBlur);
    clearTransforms();
    if (!commit || d.curIndex === d.startIndex) {
      orderedGames.forEach((g, i) => {
        const badge = rowRefs.current.get(g.id)?.querySelector('.op-points-num');
        if (badge) badge.textContent = totalGames - i;
      });
    }
    // Swallow the click that follows releasing a drag so it can't pick a team
    suppressClick.current = true;
    setTimeout(() => { suppressClick.current = false; }, 0);
    if (commit && d.curIndex !== d.startIndex) {
      onMove(d.gameId, d.startIndex, d.curIndex);
    }
  };

  // Make sure nothing leaks if the component unmounts mid-drag
  useEffect(() => () => {
    clearHold();
    document.removeEventListener('touchmove', preventTouchScroll);
  }, [preventTouchScroll]);

  // A drag whose pointer vanished (should not happen on real hardware, but
  // never leave the UI wedged): any fresh press cancels it and starts over
  const recoverStaleDrag = (e) => {
    if (drag.current && e.pointerId !== drag.current.pointerId) {
      endDrag(false);
    }
  };

  // --- Grip: drag starts immediately ---
  const onGripPointerDown = (e, gameId, index) => {
    if (readOnly) return;
    recoverStaleDrag(e);
    if (drag.current) return;
    if (e.button !== undefined && e.button !== 0) return;
    e.preventDefault();
    startDrag(gameId, index, e.pointerId, e.clientY, e.currentTarget);
  };

  // --- Row: drag starts after press-and-hold ---
  const onRowPointerDown = (e, gameId, index) => {
    if (readOnly) return;
    recoverStaleDrag(e);
    if (drag.current) return;
    if (e.button !== undefined && e.button !== 0) return;
    // The grip has its own handler
    if (e.target.closest('.op-grip')) return;

    const rowEl = e.currentTarget;
    clearHold();
    hold.current = {
      gameId,
      index,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      timer: setTimeout(() => {
        const h = hold.current;
        hold.current = null;
        if (h) startDrag(h.gameId, h.index, h.pointerId, h.startY, rowEl);
      }, HOLD_MS),
    };
  };

  const onRowPointerMove = (e) => {
    if (drag.current) {
      if (e.pointerId !== drag.current.pointerId) return;
      moveDrag(e.clientY);
      return;
    }
    const h = hold.current;
    if (h && e.pointerId === h.pointerId) {
      // Finger moved before the hold armed: user is scrolling or tapping
      if (
        Math.abs(e.clientX - h.startX) > HOLD_SLOP_PX ||
        Math.abs(e.clientY - h.startY) > HOLD_SLOP_PX
      ) {
        clearHold();
      }
    }
  };

  const onRowPointerUp = (e) => {
    if (drag.current && e.pointerId === drag.current.pointerId) endDrag(true);
    else clearHold();
  };

  const onRowPointerCancel = (e) => {
    if (drag.current && e.pointerId === drag.current.pointerId) endDrag(false);
    else clearHold();
  };

  // After a drag, the release also fires a click on whatever is under the
  // pointer; capture it before it reaches a team button
  const onRowClickCapture = (e) => {
    if (suppressClick.current) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  const renderTeam = (game, side) => {
    const teamId = game[`${side}_id`];
    const name = game[`${side}_name`];
    const city = game[`${side}_city`];
    const wins = game[`${side}_wins`];
    const losses = game[`${side}_losses`];
    const ties = game[`${side}_ties`];
    const selected = picks[`GAME${game.id}`] == teamId;

    return (
      <button
        type="button"
        className={`op-team ${selected ? 'op-team-selected' : ''} ${side === 'home' ? 'op-team-home' : ''}`}
        onClick={() => !readOnly && onPick(game.id, teamId)}
        disabled={readOnly}
        aria-pressed={selected}
      >
        <img
          src={teamLogoSrc(name)}
          alt=""
          className="op-team-logo"
          draggable={false}
          onError={(e) => { e.target.style.visibility = 'hidden'; }}
        />
        <span className="op-team-text">
          <span className="op-team-name">
            <span className="op-team-city">{city} </span>{name}
          </span>
          <span className="op-team-record">
            {wins}-{losses}{ties > 0 ? `-${ties}` : ''}
          </span>
        </span>
        {selected && <span className="op-team-check" aria-hidden="true">✓</span>}
      </button>
    );
  };

  return (
    <div className="op-list">
      <div className="op-head" aria-hidden="true">
        <span className="op-head-pts">Pts</span>
        <span className="op-head-team">Away</span>
        <span className="op-at op-head-at">@</span>
        <span className="op-head-team op-head-home">Home</span>
        {!readOnly && <span className="op-head-grip" />}
      </div>
      {orderedGames.map((game, index) => {
        const pointValue = totalGames - index;
        return (
          <div
            key={game.id}
            ref={setRowRef(game.id)}
            className={`op-row ${
              hasError(game.id) ? 'op-row-error' : isIncomplete(game.id) ? 'op-row-incomplete' : ''
            }`}
            onPointerDown={!readOnly ? (e) => onRowPointerDown(e, game.id, index) : undefined}
            onPointerMove={!readOnly ? onRowPointerMove : undefined}
            onPointerUp={!readOnly ? onRowPointerUp : undefined}
            onPointerCancel={!readOnly ? onRowPointerCancel : undefined}
            onClickCapture={!readOnly ? onRowClickCapture : undefined}
          >
            <div className="op-points" title={`${pointValue} points if correct`}>
              <span className="op-points-num">{pointValue}</span>
              <span className="op-points-label">pts</span>
            </div>

            {renderTeam(game, 'away')}
            <div className="op-at">@</div>
            {renderTeam(game, 'home')}

            {!readOnly && (
              <div
                className="op-grip"
                aria-hidden="true"
                onPointerDown={(e) => onGripPointerDown(e, game.id, index)}
              >
                <GripVertical size={18} />
              </div>
            )}
          </div>
        );
      })}

      <style jsx="true">{`
        .op-list {
          display: flex;
          flex-direction: column;
          gap: ${ROW_GAP_PX}px;
        }

        .op-head {
          display: flex;
          align-items: center;
          gap: 0.6rem;
          padding: 0 0.6rem;
          font-size: 0.7rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: rgba(150, 200, 255, 0.85);
        }

        .op-head-pts {
          min-width: 52px;
          text-align: center;
        }

        .op-head-team {
          flex: 1;
          min-width: 0;
          padding-left: 0.6rem;
        }

        .op-head-home {
          text-align: right;
          padding-left: 0;
          padding-right: 0.6rem;
        }

        .op-head-at {
          visibility: hidden;
        }

        .op-head-grip {
          width: 34px;
          flex-shrink: 0;
        }

        .op-row {
          display: flex;
          align-items: stretch;
          gap: 0.6rem;
          padding: 0.5rem 0.6rem;
          border-radius: 14px;
          /* Solid-ish background on purpose: rows move, and moving
             backdrop-filter elements is what made the old view stutter. */
          background: rgba(18, 26, 44, 0.88);
          border: 1px solid rgba(255, 255, 255, 0.12);
          transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease;
          position: relative;
          /* Vertical swipes scroll normally; the hold timer arms the drag */
          touch-action: pan-y;
          -webkit-user-select: none;
          user-select: none;
        }

        .op-row-dragging {
          box-shadow: 0 12px 32px rgba(0, 0, 0, 0.55);
          border-color: rgba(100, 150, 255, 0.6);
          cursor: grabbing;
        }

        .op-row-incomplete {
          box-shadow: 0 0 20px rgba(100, 150, 255, 0.3);
          border-color: rgba(100, 150, 255, 0.4);
        }

        .op-row-error {
          box-shadow: 0 0 20px rgba(255, 100, 100, 0.4);
          border-color: rgba(255, 100, 100, 0.6);
        }

        .op-points {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-width: 52px;
          border-radius: 10px;
          background: linear-gradient(135deg, rgba(100, 150, 255, 0.35), rgba(100, 150, 255, 0.15));
          border: 1px solid rgba(100, 150, 255, 0.35);
        }

        .op-points-num {
          font-size: 1.25rem;
          font-weight: 700;
          color: rgba(190, 215, 255, 1);
          line-height: 1.1;
        }

        .op-points-label {
          font-size: 0.65rem;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: rgba(190, 215, 255, 0.7);
        }

        .op-team {
          flex: 1;
          min-width: 0;
          display: flex;
          align-items: center;
          gap: 0.6rem;
          padding: 0.45rem 0.6rem;
          border-radius: 10px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.12);
          color: white;
          cursor: pointer;
          text-align: left;
          font: inherit;
          transition: background 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease;
        }

        .op-team:hover:not(:disabled) {
          background: rgba(255, 255, 255, 0.1);
          border-color: rgba(255, 255, 255, 0.25);
        }

        .op-team:disabled {
          cursor: default;
        }

        .op-team-selected,
        .op-team-selected:hover:not(:disabled) {
          background: rgba(100, 150, 255, 0.22);
          border-color: rgba(100, 150, 255, 0.65);
          box-shadow: 0 0 14px rgba(100, 150, 255, 0.25);
        }

        .op-team-home {
          flex-direction: row-reverse;
          text-align: right;
        }

        .op-team-logo {
          width: 34px;
          height: 34px;
          flex-shrink: 0;
          pointer-events: none;
        }

        .op-team-text {
          display: flex;
          flex-direction: column;
          min-width: 0;
        }

        .op-team-name {
          font-weight: 600;
          font-size: 0.95rem;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .op-team-record {
          font-size: 0.72rem;
          color: rgba(255, 255, 255, 0.55);
        }

        .op-team-check {
          margin: 0 0.25rem;
          color: rgba(150, 200, 255, 1);
          font-weight: 700;
          flex-shrink: 0;
        }

        .op-at {
          display: flex;
          align-items: center;
          color: rgba(255, 255, 255, 0.4);
          font-weight: 600;
          flex-shrink: 0;
        }

        .op-grip {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 34px;
          flex-shrink: 0;
          border-radius: 8px;
          color: rgba(255, 255, 255, 0.45);
          cursor: grab;
          /* The grip claims the gesture instantly - no hold needed */
          touch-action: none;
          -webkit-user-select: none;
          user-select: none;
        }

        .op-grip:active {
          cursor: grabbing;
          color: rgba(150, 200, 255, 1);
        }

        @media (max-width: 640px) {
          .op-team-city,
          .op-at {
            display: none;
          }

          .op-team-record {
            font-size: 0.62rem;
          }

          .op-head-pts {
            min-width: 40px;
          }

          .op-head-team {
            padding-left: 0.45rem;
          }

          .op-head-home {
            padding-left: 0;
            padding-right: 0.45rem;
          }

          .op-head-grip {
            width: 30px;
          }

          .op-head {
          display: flex;
          align-items: center;
          gap: 0.6rem;
          padding: 0 0.6rem;
          font-size: 0.7rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: rgba(150, 200, 255, 0.85);
        }

        .op-head-pts {
          min-width: 52px;
          text-align: center;
        }

        .op-head-team {
          flex: 1;
          min-width: 0;
          padding-left: 0.6rem;
        }

        .op-head-home {
          text-align: right;
          padding-left: 0;
          padding-right: 0.6rem;
        }

        .op-head-at {
          visibility: hidden;
        }

        .op-head-grip {
          width: 34px;
          flex-shrink: 0;
        }

        .op-row {
            gap: 0.35rem;
            padding: 0.4rem;
          }

          .op-points {
            min-width: 40px;
          }

          .op-team {
            padding: 0.4rem 0.45rem;
            gap: 0.4rem;
          }

          .op-team-name {
            font-size: 0.85rem;
          }

          .op-team-logo {
            width: 26px;
            height: 26px;
          }

          .op-team-check {
            display: none;
          }

          .op-grip {
            width: 30px;
          }
        }
      `}</style>
    </div>
  );
}

export default React.memo(OrderPicksView);
