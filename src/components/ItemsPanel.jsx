import React from 'react';
import ChroniclePanel from './ChroniclePanel';

const ItemsPanel = ({ items = [], onClose }) => {
  return (
    <ChroniclePanel title="Items" onClose={onClose}>
      {items.length === 0 ? (
        <p className="font-cardo text-sm text-white/35 italic leading-7">
          Your hands are empty. What the world offers, you will carry here.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((item, i) => (
            <li key={item.id ?? i} className="border-b border-white/8 pb-3 last:border-0 last:pb-0">
              <p className="font-cardo text-sm text-white/90">{item.name}</p>
              {item.description && (
                <p className="font-cardo text-xs text-white/45 mt-1 leading-5">{item.description}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </ChroniclePanel>
  );
};

export default ItemsPanel;
