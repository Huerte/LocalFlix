package com.sarge.localflix

import android.view.KeyEvent
import android.view.View
import android.widget.EditText

/**
 * Keeps the TV remote's D-pad inside a pop-up panel (player menus, dialogs, connect screen).
 *
 * Android resolves the next focus target by searching the WHOLE window, so pressing Down on the last
 * item in a panel normally jumps to whatever lies below it (e.g. player controls behind a subtitle menu).
 * Call [blocks] from dispatchKeyEvent before the normal super dispatch: when it returns true the key must
 * be consumed, because it would otherwise move focus out of [panel].
 */
object FocusTrap {

    private fun direction(keyCode: Int): Int = when (keyCode) {
        KeyEvent.KEYCODE_DPAD_UP    -> View.FOCUS_UP
        KeyEvent.KEYCODE_DPAD_DOWN  -> View.FOCUS_DOWN
        KeyEvent.KEYCODE_DPAD_LEFT  -> View.FOCUS_LEFT
        KeyEvent.KEYCODE_DPAD_RIGHT -> View.FOCUS_RIGHT
        else                        -> -1
    }

    /** True if [v] is [panel] or a descendant of [panel]. */
    fun inside(v: View?, panel: View): Boolean {
        var p: View? = v
        while (p != null) {
            if (p === panel) return true
            p = p.parent as? View
        }
        return false
    }

    private fun firstFocusable(panel: View): View? {
        val list = ArrayList<View>()
        panel.addFocusables(list, View.FOCUS_DOWN)
        return list.firstOrNull { it.isShown }
    }

    /**
     * Returns true if the key event would move focus OUT of [panel] (or if focus is already outside it).
     *
     * Callers should swallow the event when this returns true.
     * If focus has escaped the panel the function also pulls it back to the first focusable child.
     *
     * Special case: inside an EditText, Left/Right still move the caret while there is text to step
     * over; only at the start/end of the value do they trigger the trap.
     */
    fun blocks(e: KeyEvent, focus: View?, panel: View): Boolean {
        val d = direction(e.keyCode)
        if (d < 0) return false

        if (focus == null || !inside(focus, panel)) {
            // Focus escaped (or was never inside): pull it back on the first DOWN event.
            if (e.action == KeyEvent.ACTION_DOWN) firstFocusable(panel)?.requestFocus()
            return true
        }

        // EditText caret movement: Left/Right only trap at the text boundaries.
        if (focus is EditText && (d == View.FOCUS_LEFT || d == View.FOCUS_RIGHT)) {
            val len = focus.text?.length ?: 0
            if ((d == View.FOCUS_LEFT && focus.selectionStart > 0) ||
                (d == View.FOCUS_RIGHT && focus.selectionEnd < len)) return false
        }

        val next = focus.focusSearch(d)
        return next == null || !inside(next, panel)
    }
}
