"use client";

interface FilterBarProps {
  categories: string[];
  selectedCategory: string;
  sort: "date_desc" | "date_asc";
  onCategoryChange: (category: string) => void;
  onSortChange: (sort: "date_desc" | "date_asc") => void;
}

export default function FilterBar({
  categories,
  selectedCategory,
  sort,
  onCategoryChange,
  onSortChange,
}: FilterBarProps) {
  return (
    <div className="filter-bar" id="filter-bar">
      <div className="filter-group">
        <label htmlFor="filter-category">Category</label>
        <select
          id="filter-category"
          value={selectedCategory}
          onChange={(e) => onCategoryChange(e.target.value)}
        >
          <option value="">All Categories</option>
          {categories.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
      </div>

      <button
        id="sort-toggle"
        className="sort-btn"
        onClick={() =>
          onSortChange(sort === "date_desc" ? "date_asc" : "date_desc")
        }
        title={sort === "date_desc" ? "Showing newest first" : "Showing oldest first"}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          className={sort === "date_asc" ? "sort-icon-flipped" : ""}
        >
          <path
            d="M8 3v10M4 9l4 4 4-4"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        {sort === "date_desc" ? "Newest First" : "Oldest First"}
      </button>
    </div>
  );
}
