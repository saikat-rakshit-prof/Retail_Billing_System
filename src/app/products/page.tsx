'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useProductStore, addSampleProducts } from '@/store/useProductStore';
import { useInventoryStore } from '@/store/useInventoryStore';
import { useToast } from '@/components/Toast';
import { useRefetchOnFocus } from '@/hooks/useRefetchOnFocus';
import { formatCurrency } from '@/lib/utils';
import { Search, Plus, Edit, Trash2, Package, Menu } from 'lucide-react';
import { Product, ProductCategory, ProductSize } from '@/types';
import { MobileAvatar } from '@/components/layout/MobileAvatar';

const PRODUCT_ICONS = [
  { name: 'Cola', emoji: '🥤' },
  { name: 'Mango', emoji: '🥭' },
  { name: 'Lemon', emoji: '🍋' },
  { name: 'Orange', emoji: '🍊' },
  { name: 'Juice', emoji: '🧃' },
  { name: 'Jeera', emoji: '🌿' },
  { name: 'Nimbu', emoji: '🍈' },
  { name: 'Thumps Up', emoji: '👍' },
  { name: 'Water', emoji: '💧' },
  { name: 'Bottle', emoji: '🫙' },
  { name: 'Energy', emoji: '⚡' },
  { name: 'Soda', emoji: '🫚' },
  { name: 'Other', emoji: '📦' },
];

const PRODUCT_SIZES = ['250ml', '400ml', '600ml', '750ml', '1L', '1.2L', '2.25L'];

const categories: ProductCategory[] = ['All', 'Soft Drinks', 'Juices', 'Energy Drinks', 'Water', 'Others'];

export default function ProductsPage() {
  const router = useRouter();
  const {
    products,
    searchQuery,
    selectedCategory,
    setSearchQuery,
    setSelectedCategory,
    addProduct,
    updateProduct,
    deleteProduct,
    getFilteredProducts,
    initializeFromStorage,
    forceRefresh: refreshProducts
  } = useProductStore();
  const { forceRefresh: refreshInventory } = useInventoryStore();
  const { addToast } = useToast();

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    brand: '',
    category: 'Soft Drinks' as ProductCategory,
    icon: '' as string | null,
    sizes: [] as ProductSize[],
  });

  useEffect(() => {
    initializeFromStorage();
    setIsLoading(false);
  }, [initializeFromStorage]);

  // Refetch on focus
  const handleProductsRefetch = useCallback(() => {
    return refreshProducts();
  }, [refreshProducts]);

  useRefetchOnFocus({
    onRefetch: handleProductsRefetch,
    staleTime: 60000, // 60 seconds
  });

  // Add sample products if empty
  useEffect(() => {
    if (!isLoading && products.length === 0) {
      addSampleProducts();
      addToast('info', 'Sample products added');
    }
  }, [isLoading, products.length]);

  const filteredProducts = getFilteredProducts();

  const handleOpenAddModal = () => {
    setFormData({
      name: '',
      brand: '',
      category: 'Soft Drinks',
      icon: null,
      sizes: [{ id: crypto.randomUUID(), name: '250ml', pricePerBottle: 0, pricePerCarton: 0, bottlesPerCarton: 12 }],
    });
    setEditingProduct(null);
    setIsAddModalOpen(true);
  };

  const handleOpenEditModal = (product: Product) => {
    setFormData({
      name: product.name,
      brand: product.brand,
      category: product.category,
      icon: product.icon || null,
      sizes: [...product.sizes],
    });
    setEditingProduct(product);
    setIsAddModalOpen(true);
  };

  const handleDeleteProduct = async (id: string) => {
    if (confirm('Are you sure you want to delete this product?')) {
      await deleteProduct(id);
      // Refresh both products and inventory after delete
      await Promise.all([refreshProducts(), refreshInventory()]);
      addToast('success', 'Product deleted');
    }
  };

  const handleAddSize = () => {
    setFormData({
      ...formData,
      sizes: [
        ...formData.sizes,
        { id: crypto.randomUUID(), name: '', pricePerBottle: 0, pricePerCarton: 0, bottlesPerCarton: 12 }
      ],
    });
  };

  const handleRemoveSize = (index: number) => {
    const newSizes = formData.sizes.filter((_, i) => i !== index);
    setFormData({ ...formData, sizes: newSizes });
  };

  const handleSizeChange = (index: number, field: keyof ProductSize, value: string | number) => {
    const newSizes = [...formData.sizes];
    newSizes[index] = { ...newSizes[index], [field]: value };
    setFormData({ ...formData, sizes: newSizes });
  };

  const handleIconChange = (iconName: string | null) => {
    setFormData({ ...formData, icon: iconName });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isSubmitting) return;

    if (!formData.name || !formData.brand || formData.sizes.length === 0) {
      addToast('error', 'Please fill in all required fields');
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingProduct) {
        await updateProduct(editingProduct.id, formData);
        addToast('success', 'Product updated');
      } else {
        await addProduct(formData);
        addToast('success', 'Product added');
      }

      setIsAddModalOpen(false);
      setEditingProduct(null);

      // Refresh both products and inventory after add/edit (in background)
      refreshProducts().catch(console.error);
      refreshInventory().catch(console.error);
    } catch (error: any) {
      console.error('Error saving product:', error);
      addToast('error', error.message || 'Failed to save product. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <div className="skeleton h-8 w-32 rounded"></div>
          <div className="skeleton h-10 w-32 rounded-lg"></div>
        </div>
        <div className="grid gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="skeleton h-32 rounded-xl"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-24 lg:pb-6">
      {/* Header */}
      <header className="mb-2 md:mb-0 md:flex md:items-start md:justify-between md:gap-3">
        <div className="flex items-center justify-between mb-1 md:mb-0 md:flex-none">
          {/* Hamburger menu for mobile */}
          <button
            onClick={() => {
              if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('toggle-sidebar'));
              }
            }}
            className="p-2 -ml-2 text-slate-600 hover:bg-slate-100 rounded-lg md:hidden"
          >
            <Menu className="w-6 h-6" />
          </button>

          <div className="flex-1 text-center md:text-left md:flex md:items-center md:gap-3 md:min-w-0">
            <h1 className="text-xl md:text-2xl md:text-3xl font-bold leading-tight">
              Products
            </h1>
            <p className="hidden md:block text-slate-500 text-sm">Manage cold drink products and pricing</p>
          </div>

          {/* Mobile Avatar */}
          <div className="md:hidden shrink-0">
            <MobileAvatar />
          </div>
        </div>
        <p className="text-xs text-slate-500 leading-snug text-center w-full truncate md:hidden">Manage cold drink products and pricing</p>

        {/* Desktop Add Button */}
        <button
          onClick={handleOpenAddModal}
          className="hidden md:flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-white px-5 py-2.5 rounded-lg font-semibold transition-colors shadow-sm"
        >
          <Plus className="w-5 h-5" />
          Add Product
        </button>
      </header>

      {/* Search and Filter */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search products, brands, or sizes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white bg-slate-800 border border-slate-200 border-slate-700 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
          />
        </div>
      </div>

      {/* Category Tabs */}
      <div
        className="flex gap-2 overflow-x-auto pb-1 hide-scrollbar whitespace-nowrap"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {categories.map((category) => (
          <button
            key={category}
            onClick={() => setSelectedCategory(category)}
            className={`flex-shrink-0 px-[14px] py-[6px] rounded-full text-[13px] font-medium whitespace-nowrap transition-colors ${selectedCategory === category
              ? 'bg-primary text-white'
              : 'bg-white bg-slate-800 border border-slate-200 border-slate-700 text-slate-600 text-slate-300 hover:border-primary'
              }`}
          >
            {category}
          </button>
        ))}
      </div>

      {/* Mobile Add Button */}
      <button
        onClick={handleOpenAddModal}
        className="md:hidden w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-white rounded-full font-semibold transition-colors shadow-sm h-[44px] text-[14px] mt-2 mb-4"
      >
        <Plus className="w-5 h-5" />
        Add Product
      </button>

      {/* Products List */}
      <div className="grid gap-4">
        {filteredProducts.length > 0 ? (
          filteredProducts.map((product) => (
            <div
              key={product.id}
              className="bg-white border border-slate-200 rounded-[12px] md:rounded-xl p-[12px] md:p-4 flex flex-row items-start md:items-center gap-3 md:gap-5 hover:shadow-md transition-shadow overflow-hidden"
            >
              {/* Product Icon */}
              <div
                className="w-[48px] h-[48px] md:w-20 md:h-20 rounded-lg bg-slate-100 flex-shrink-0 flex items-center justify-center"
              >
                {product.icon && (() => {
                  const iconObj = PRODUCT_ICONS.find(i => i.name === product.icon);
                  return iconObj ? <span className="text-[24px] md:text-[32px]">{iconObj.emoji}</span> : <Package className="w-[24px] h-[24px] md:w-8 md:h-8 text-slate-400" />;
                })()}
                {!product.icon && (
                  <Package className="w-[24px] h-[24px] md:w-8 md:h-8 text-slate-400" />
                )}
              </div>

              {/* Product Info */}
              <div className="flex-1 min-w-0 w-full">
                <div className="flex items-start justify-between gap-2 mb-0.5 md:mb-1">
                  <h3 className="text-[15px] md:text-lg font-semibold md:font-bold truncate">{product.name}</h3>
                  <div className="flex gap-1 shrink-0 -mt-1 md:mt-0">
                    <button
                      onClick={() => handleOpenEditModal(product)}
                      className="p-1 md:p-2 text-slate-400 hover:text-primary transition-colors"
                    >
                      <Edit className="w-[16px] h-[16px] md:w-5 md:h-5" style={{ color: '#2563eb' }} />
                    </button>
                    <button
                      onClick={() => handleDeleteProduct(product.id)}
                      className="p-1 md:p-2 text-slate-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-[16px] h-[16px] md:w-5 md:h-5" style={{ color: '#dc2626' }} />
                    </button>
                  </div>
                </div>
                <p className="text-[12px] md:text-sm text-slate-500 mb-0.5 md:mb-2 truncate">
                  Brand: <span className="font-medium">{product.brand}</span>
                </p>
                <div className="flex flex-col md:flex-row md:flex-wrap items-start md:gap-y-3 md:gap-x-6 min-w-0 space-y-0.5 md:space-y-0">
                  <div className="flex flex-col md:block truncate w-full">
                    <span className="hidden md:inline text-[10px] uppercase tracking-wider text-slate-400 font-bold md:mb-1">Available Sizes </span>
                    <span className="md:hidden text-[12px] text-slate-500">Sizes: </span>
                    <span className="text-[12px] md:text-sm text-slate-600 truncate">
                      {product.sizes.map(s => s.name).join(', ')}
                    </span>
                  </div>
                  <div className="hidden md:flex flex-col md:block truncate w-full">
                    <span className="hidden md:inline text-[10px] uppercase tracking-wider text-slate-400 font-bold md:mb-1">Pricing </span>
                    <div className="flex flex-row md:flex-row gap-1.5 md:gap-3 text-[12px] md:text-sm font-medium text-slate-500 md:text-slate-700 truncate">
                      <span className="md:text-slate-700">
                        Bottle <span className="md:text-primary">₹{product.sizes[0]?.pricePerBottle || 0}</span>
                      </span>
                      <span>•</span>
                      <span className="md:text-slate-700">
                        Carton <span className="md:text-primary">₹{product.sizes[0]?.pricePerCarton || 0}</span>
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-12 bg-white bg-slate-800 rounded-xl border border-slate-200 border-slate-700">
            <Package className="w-12 h-12 mx-auto mb-2 text-slate-400" />
            <p className="text-slate-500">No products found</p>
            <button
              onClick={handleOpenAddModal}
              className="mt-4 text-primary font-medium hover:underline"
            >
              Add your first product
            </button>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-end md:items-center justify-center bg-black/50 backdrop-blur-sm p-0 md:p-4">
          <div className="bg-white w-full max-w-lg rounded-t-[20px] md:rounded-2xl pt-[20px] px-[16px] pb-[32px] md:p-0 shadow-2xl max-h-[90vh] flex flex-col mt-auto md:mt-0">
            {/* Drag Handle (Mobile) */}
            <div className="w-[40px] h-[4px] bg-[#e5e7eb] rounded-sm mx-auto mb-4 md:hidden" />

            <div className="md:p-6 md:border-b md:border-slate-100 flex justify-between items-center flex-shrink-0 mb-[14px] md:mb-0">
              <h2 className="text-[17px] font-semibold md:text-lg md:font-semibold text-slate-900">
                {editingProduct ? 'Edit Product' : 'Add New Product'}
              </h2>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-[20px] text-[#6b7280] md:text-slate-400 md:hover:text-slate-600 md:hover:bg-slate-100 md:rounded-lg p-1 transition-colors"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="md:p-6 space-y-5 overflow-y-auto flex-1">
              {/* Icon Selection */}
              <div>
                <label className="block text-[10px] md:text-xs font-semibold uppercase tracking-[0.05em] md:tracking-wider text-[#9ca3af] md:text-slate-500 mb-[6px] md:mb-3">Select Icon</label>
                <div className="grid grid-cols-4 md:flex md:flex-wrap gap-[8px] md:gap-3">
                  {PRODUCT_ICONS.map((option) => {
                    const isSelected = formData.icon === option.name;
                    return (
                      <button
                        key={option.name}
                        type="button"
                        onClick={() => handleIconChange(option.name === 'Other' ? null : option.name)}
                        className={`w-full md:w-14 h-[52px] md:h-14 rounded-[12px] border-[1.5px] md:border-2 flex flex-col md:flex-row items-center justify-center transition-all ${isSelected
                          ? 'border-[#16a34a] bg-[#f0fdf4]'
                          : 'border-[#e5e7eb] bg-white md:bg-slate-50 hover:border-primary/50'
                          }`}
                      >
                        <span className="text-[24px] leading-none mb-[2px] md:mb-0">{option.emoji}</span>
                        <span className="text-[9px] md:hidden text-[#6b7280] leading-none">{option.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Name and Brand */}
              <div className="grid grid-cols-2 gap-[10px] md:gap-4">
                <div>
                  <label className="block text-[10px] md:text-xs font-semibold uppercase tracking-[0.05em] md:tracking-wider text-[#9ca3af] md:text-slate-500 mb-[6px] md:mb-1.5">Product Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full h-[44px] md:h-11 px-[12px] md:px-3 rounded-[10px] md:rounded-lg border-[1.5px] md:border border-[#e5e7eb] md:border-slate-200 bg-white text-[14px] md:text-base text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                    placeholder="Product name"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] md:text-xs font-semibold uppercase tracking-[0.05em] md:tracking-wider text-[#9ca3af] md:text-slate-500 mb-[6px] md:mb-1.5">Brand</label>
                  <input
                    type="text"
                    value={formData.brand}
                    onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                    className="w-full h-[44px] md:h-11 px-[12px] md:px-3 rounded-[10px] md:rounded-lg border-[1.5px] md:border border-[#e5e7eb] md:border-slate-200 bg-white text-[14px] md:text-base text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                    placeholder="Brand name"
                    required
                  />
                </div>
              </div>

              {/* Category */}
              <div>
                <label className="block text-[10px] md:text-xs font-semibold uppercase tracking-[0.05em] md:tracking-wider text-[#9ca3af] md:text-slate-500 mb-[6px] md:mb-1.5">Category</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value as ProductCategory })}
                  className="w-full h-[44px] md:h-11 px-[12px] md:px-3 rounded-[10px] md:rounded-lg border-[1.5px] md:border border-[#e5e7eb] md:border-slate-200 bg-white text-[14px] md:text-base text-slate-900 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                >
                  {categories.filter(c => c !== 'All').map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              {/* Sizes */}
              <div>
                <div className="flex justify-between items-center mb-3">
                  <label className="block text-[10px] md:text-xs font-semibold uppercase tracking-[0.05em] md:tracking-wider text-[#9ca3af] md:text-slate-500">Sizes & Pricing</label>
                  <button
                    type="button"
                    onClick={handleAddSize}
                    className="text-[#16a34a] md:text-primary text-[13px] md:text-sm font-medium md:hover:underline"
                  >
                    + Add Size
                  </button>
                </div>
                <div className="space-y-3">
                  {formData.sizes.map((size, index) => (
                    <div key={size.id} className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                      {/* Quick select chips */}
                      <div className="flex flex-wrap gap-[8px] md:gap-1.5 mb-4">
                        {PRODUCT_SIZES.map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => handleSizeChange(index, 'name', preset)}
                            className={`px-[14px] md:px-3 py-[6px] md:py-1 text-[13px] md:text-xs font-medium rounded-full transition-all ${size.name === preset
                              ? 'bg-[#16a34a] md:bg-primary text-white border-[#16a34a] md:border-primary'
                              : 'bg-white md:bg-slate-100 text-[#374151] md:text-slate-600 border-[1.5px] border-[#e5e7eb] md:border md:border-slate-200 hover:border-[#16a34a] md:hover:border-primary md:hover:text-primary'
                              }`}
                          >
                            {preset}
                          </button>
                        ))}
                      </div>

                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-[10px] md:gap-3">
                        <div>
                          <label className="block text-[10px] uppercase tracking-[0.05em] md:tracking-wider text-[#9ca3af] md:text-slate-400 font-bold mb-[6px] md:mb-1">Size</label>
                          <input
                            type="text"
                            value={size.name}
                            onChange={(e) => handleSizeChange(index, 'name', e.target.value)}
                            className="w-full h-[44px] md:h-11 px-[12px] md:px-3 rounded-[10px] md:rounded-lg border-[1.5px] md:border border-[#e5e7eb] md:border-slate-200 bg-white text-[14px] md:text-sm text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                            placeholder="500ml"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] uppercase tracking-[0.05em] md:tracking-wider text-[#9ca3af] md:text-slate-400 font-bold mb-[6px] md:mb-1">Price/Bottle ₹</label>
                          <input
                            type="number"
                            value={size.pricePerBottle || ''}
                            onChange={(e) => handleSizeChange(index, 'pricePerBottle', Number(e.target.value))}
                            className="w-full h-[44px] md:h-11 px-[12px] md:px-3 rounded-[10px] md:rounded-lg border-[1.5px] md:border border-[#e5e7eb] md:border-slate-200 bg-white text-[14px] md:text-sm text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                            placeholder="20"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] uppercase tracking-[0.05em] md:tracking-wider text-[#9ca3af] md:text-slate-400 font-bold mb-[6px] md:mb-1">Price/Carton ₹</label>
                          <input
                            type="number"
                            value={size.pricePerCarton || ''}
                            onChange={(e) => handleSizeChange(index, 'pricePerCarton', Number(e.target.value))}
                            className="w-full h-[44px] md:h-11 px-[12px] md:px-3 rounded-[10px] md:rounded-lg border-[1.5px] md:border border-[#e5e7eb] md:border-slate-200 bg-white text-[14px] md:text-sm text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                            placeholder="220"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] uppercase tracking-[0.05em] md:tracking-wider text-[#9ca3af] md:text-slate-400 font-bold mb-[6px] md:mb-1">Bottles/Carton</label>
                          <input
                            type="number"
                            value={size.bottlesPerCarton || ''}
                            onChange={(e) => handleSizeChange(index, 'bottlesPerCarton', Number(e.target.value))}
                            className="w-full h-[44px] md:h-11 px-[12px] md:px-3 rounded-[10px] md:rounded-lg border-[1.5px] md:border border-[#e5e7eb] md:border-slate-200 bg-white text-[14px] md:text-sm text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                            placeholder="12"
                            required
                          />
                        </div>
                      </div>

                      {formData.sizes.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveSize(index)}
                          className="text-red-500 text-xs hover:underline mt-3"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </form>

            {/* Actions - Sticky Footer */}
            <div className="sticky bottom-0 bg-white border-t border-slate-100 md:relative md:bg-transparent md:border-t md:border-slate-100 p-[12px_0] md:p-6 flex justify-between md:justify-end gap-[10px] md:gap-3 flex-shrink-0 z-10 mt-4 md:mt-0">
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="flex-1 md:flex-none h-[46px] md:h-auto md:px-5 md:py-2.5 text-[15px] md:text-sm font-semibold md:font-medium text-[#374151] md:text-slate-600 border-[1.5px] border-[#e5e7eb] md:border md:border-slate-200 bg-white hover:bg-slate-50 rounded-[10px] md:rounded-lg transition-colors flex items-center justify-center"
              >
                Cancel
              </button>
              <button
                type="submit"
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="flex-1 md:flex-none h-[46px] md:h-auto md:px-6 md:py-2.5 bg-[#16a34a] md:bg-primary text-white text-[15px] md:text-sm font-semibold rounded-[10px] md:rounded-lg shadow-md transition-colors flex items-center justify-center"
                style={{
                  opacity: isSubmitting ? 0.6 : 1,
                  cursor: isSubmitting ? 'not-allowed' : 'pointer',
                }}
              >
                {isSubmitting ? 'Saving...' : (editingProduct ? 'Update Product' : 'Save Product')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
