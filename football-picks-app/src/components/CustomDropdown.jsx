import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';

const MENU_MAX_HEIGHT = 260;
const MENU_MIN_WIDTH = 140;
const VIEWPORT_MARGIN = 8;

/**
 * The menu renders into document.body through a portal with fixed
 * positioning, so it can never be trapped or covered by a parent's stacking
 * context (glass containers create those), and it is clamped to the viewport
 * so it can't run off screen.
 */
const CustomDropdown = ({
  options,
  value,
  onChange,
  placeholder = "Select an option",
  className = "",
  disabled = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [menuPos, setMenuPos] = useState(null);
  const dropdownRef = useRef(null);
  const menuRef = useRef(null);

  const selectedOption = options.find(opt => opt.value === value) || null;

  const positionMenu = useCallback(() => {
    const trigger = dropdownRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const width = Math.max(rect.width, MENU_MIN_WIDTH);
    // Keep the menu inside the viewport horizontally
    let left = rect.left;
    if (left + width > window.innerWidth - VIEWPORT_MARGIN) {
      left = Math.max(VIEWPORT_MARGIN, window.innerWidth - VIEWPORT_MARGIN - width);
    }
    // Open upward when there is not enough room below
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUp = spaceBelow < Math.min(MENU_MAX_HEIGHT, 180) && rect.top > spaceBelow;
    setMenuPos({
      left,
      width,
      top: openUp ? undefined : rect.bottom + 4,
      bottom: openUp ? window.innerHeight - rect.top + 4 : undefined,
    });
  }, []);

  // Close when clicking outside the trigger AND the portaled menu
  useEffect(() => {
    const handlePointerDown = (event) => {
      if (dropdownRef.current?.contains(event.target)) return;
      if (menuRef.current?.contains(event.target)) return;
      setIsOpen(false);
    };
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, []);

  // Track the trigger while open (page scroll, resizes)
  useEffect(() => {
    if (!isOpen) return;
    positionMenu();
    window.addEventListener('scroll', positionMenu, true);
    window.addEventListener('resize', positionMenu);
    return () => {
      window.removeEventListener('scroll', positionMenu, true);
      window.removeEventListener('resize', positionMenu);
    };
  }, [isOpen, positionMenu]);

  const handleOptionClick = (option) => {
    onChange(option.value);
    setIsOpen(false);
  };

  const toggleDropdown = () => {
    if (!disabled) setIsOpen(o => !o);
  };

  return (
    <div className={`custom-dropdown ${className} ${disabled ? 'disabled' : ''}`} ref={dropdownRef}>
      <div
        className="dropdown-trigger"
        onClick={toggleDropdown}
      >
        <span className="dropdown-value">
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown
          size={16}
          className={`dropdown-arrow ${isOpen ? 'open' : ''}`}
        />
      </div>

      {isOpen && menuPos && createPortal(
        <div
          className="dropdown-menu"
          ref={menuRef}
          style={{
            position: 'fixed',
            top: menuPos.top,
            bottom: menuPos.bottom,
            left: menuPos.left,
            width: menuPos.width,
            maxHeight: MENU_MAX_HEIGHT,
          }}
        >
          {options.map((option) => (
            <div
              key={option.value}
              className={`dropdown-option ${selectedOption?.value === option.value ? 'selected' : ''}`}
              onClick={() => handleOptionClick(option)}
            >
              {option.label}
            </div>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
};

export default CustomDropdown;
