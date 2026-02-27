"use client";

/**
 * CATEGORY FILTER COMPONENT
 * 
 * Horizontal filter bar with category chips
 */

import styles from "./catalog.module.css";

interface CategoryFilterProps {
  categories: { slug: string; name: string }[];
  selectedCategory: string | null;
  onSelectCategory: (category: string | null) => void;
}

export function CategoryFilter({
  categories,
  selectedCategory,
  onSelectCategory,
}: CategoryFilterProps) {
  return (
    <div className={styles.filterSection}>
      <span className={styles.filterLabel}>Filter by:</span>
      
      <button
        className={`${styles.filterChip} ${
          selectedCategory === null ? styles.filterChipActive : ""
        }`}
        onClick={() => onSelectCategory(null)}
      >
        All Plans
      </button>
      
      {categories.map((category) => (
        <button
          key={category.slug}
          className={`${styles.filterChip} ${
            selectedCategory === category.slug ? styles.filterChipActive : ""
          }`}
          onClick={() => onSelectCategory(category.slug)}
        >
          {category.name}
        </button>
      ))}
    </div>
  );
}
