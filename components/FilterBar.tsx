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
    <div className="filter-bar" role="search" aria-label="Filter expenses">
      <div className="filter-group">
        <label htmlFor="filter-category" className="filter-label">
          Category
        </label>
        <select
          id="filter-category"
          value={selectedCategory}
          onChange={(e) => onCategoryChange(e.target.value)}
          className="filter-select"
          aria-label="Filter by category"
        >
          <option value="">All Categories</option>
          {categories.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
      </div>

      <div className="filter-group">
        <label htmlFor="filter-sort" className="filter-label">
          Sort
        </label>
        <button
          id="filter-sort"
          onClick={() =>
            onSortChange(sort === "date_desc" ? "date_asc" : "date_desc")
          }
          className="sort-btn"
          aria-label={`Sort by date, currently ${sort === "date_desc" ? "newest first" : "oldest first"}`}
        >
          {sort === "date_desc" ? "Newest First ↓" : "Oldest First ↑"}
        </button>
      </div>
    </div>
  );
}
