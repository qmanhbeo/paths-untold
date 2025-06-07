const StoryDisplay = ({ storyHtml, scrollRef }) => (
    <div className="flex-grow rounded-lg p-4 mb-4 overflow-y-auto" ref={scrollRef}>
      <div className="w-full h-full border-none outline-none resize-none">
        <p
          className="font-cardo text-white mix-blend-difference"
          dangerouslySetInnerHTML={{ __html: storyHtml || 'Almost There... Your World is Forming...' }}
        />
      </div>
    </div>
  );
  
  export default StoryDisplay;
  