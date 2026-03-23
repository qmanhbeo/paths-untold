// src/components/GameScreenComponents/ChoiceGrid.js
const ChoiceGrid = ({ choices, onChoice, disabled = false }) => {
    return (
      <div className="font-cardo grid grid-cols-2 gap-4 h-[220px]">
        {choices.length > 0 ? (
          choices.map((choice, index) => (
            <button
              key={index}
              disabled={disabled}
              className="border border-gray-300 rounded-lg p-6 flex items-center justify-center text-center h-[100px] text-white mix-blend-difference disabled:opacity-50"
              onClick={() => onChoice(choice, index)}
            >
              {choice}
            </button>
          ))
        ) : (
          <div className="col-span-2 flex items-center justify-center h-[100px]">
            <p className="text-white mix-blend-difference">Preparing your next decisions...</p>
          </div>
        )}
      </div>
    );
  };
  
  export default ChoiceGrid;
  
