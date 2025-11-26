(function() {
    'use strict';
    
    // DOM ELEMENTS
    const cartToggle = document.getElementById('cart-toggle');
    const mobileCartBtn = document.getElementById('mobile-cart-btn');
    const cartSidebar = document.getElementById('cart-sidebar');
    const closeCartBtn = document.getElementById('close-cart');
    const cartItemsContainer = document.getElementById('cart-items');
    const cartFooter = document.getElementById('cart-footer');
    const cartTotalEl = document.getElementById('cart-total');
    const cartCountEl = document.getElementById('cart-count');
    const mobileCartCountEl = document.getElementById('mobile-cart-count');
    const pincodeButton = document.getElementById('pincode-button');
    const pincodeModal = document.getElementById('pincode-modal');
    const pincodeForm = document.getElementById('pincode-form');
    const cancelPincodeBtn = document.getElementById('cancel-pincode');

    // --- INITIALIZATION ---
    document.addEventListener('DOMContentLoaded', function() {
        initializeEventListeners();
        loadCart();
    });

    function saveCartToBrowser(cartItems) {
        if (typeof(Storage) !== "undefined") {
            localStorage.setItem('tempCart', JSON.stringify(cartItems));
            console.log("Cart backed up to LocalStorage");
        }
    }

    function loadCartFromBrowser() {
        if (typeof(Storage) !== "undefined") {
            const savedCart = localStorage.getItem('tempCart');
            if (savedCart) {
                console.log("Restoring cart from LocalStorage:", JSON.parse(savedCart));
                return JSON.parse(savedCart);
            }
        }
        return [];
    }
    
    // --- EVENT LISTENERS ---
    function initializeEventListeners() {
        if (cartToggle) cartToggle.addEventListener('click', toggleCart);
        if (mobileCartBtn) mobileCartBtn.addEventListener('click', toggleCart);
        if (closeCartBtn) closeCartBtn.addEventListener('click', closeCartSidebar);

        if (pincodeButton) {
            pincodeButton.addEventListener('click', () => pincodeModal.classList.remove('hidden'));
        }
        if (cancelPincodeBtn) {
            cancelPincodeBtn.addEventListener('click', () => pincodeModal.classList.add('hidden'));
        }
        if (pincodeForm) {
            pincodeForm.addEventListener('submit', handlePincodeSubmit);
        }
        
        document.addEventListener('click', handleDynamicClicks);

        // NEW FOR PHASE 3: Add event listener for the checkout button
        const checkoutBtn = document.querySelector('[data-testid="button-checkout"]');
        if (checkoutBtn) checkoutBtn.addEventListener('click', handleCheckout);
    }
    
    // --- EVENT HANDLERS ---
    function handleDynamicClicks(e) {
        const addToCartBtn = e.target.closest('.add-to-cart-btn');
        const decreaseBtn = e.target.closest('.quantity-decrease');
        const increaseBtn = e.target.closest('.quantity-increase');
        const removeBtn = e.target.closest('.remove-item');

        if (addToCartBtn) {
            e.preventDefault();
            const productId = addToCartBtn.getAttribute('data-product-id');
            addToCart(productId, addToCartBtn);
        } else if (decreaseBtn) {
            const itemId = decreaseBtn.getAttribute('data-item-id');
            const currentQuantity = parseInt(decreaseBtn.nextElementSibling.textContent);
            updateCartItem(itemId, currentQuantity - 1);
        } else if (increaseBtn) {
            const itemId = increaseBtn.getAttribute('data-item-id');
            const currentQuantity = parseInt(increaseBtn.previousElementSibling.textContent);
            updateCartItem(itemId, currentQuantity + 1);
        } else if (removeBtn) {
            const itemId = removeBtn.getAttribute('data-item-id');
            removeFromCart(itemId);
        }
    }

    async function handlePincodeSubmit(e) {
        e.preventDefault();
        const pincodeInput = document.getElementById('pincode-input');
        const pincode = pincodeInput.value;

        try {
            const response = await fetch('/api/pincode', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pincode })
            });

            if (response.ok) {
                window.location.reload(true);
            } else {
                alert('Please enter a valid 6-digit pincode.');
            }
        } catch (error) {
            console.error('Failed to update pincode:', error);
            alert('An error occurred. Please try again.');
        }
    }

    // --- CART FUNCTIONS ---
    function toggleCart() {
        if (!cartSidebar) return;
        cartSidebar.classList.contains('open') ? closeCartSidebar() : openCartSidebar();
    }
    
    function openCartSidebar() {
        if (cartSidebar) {
            cartSidebar.classList.remove('closed');
            cartSidebar.classList.add('open');
            loadCart();
        }
    }
    
    function closeCartSidebar() {
        if (cartSidebar) {
            cartSidebar.classList.remove('open');
            cartSidebar.classList.add('closed');
        }
    }
    
    async function addToCart(productId, buttonElement) {
        const originalText = buttonElement.textContent;
        buttonElement.textContent = '...';
        buttonElement.disabled = true;
        
        try {
            const response = await fetch('/api/cart/add', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ productId, quantity: 1 })
            });
            const data = await response.json();
            saveCartToBrowser(data.items); // Save new state to browser cache
            if (!response.ok) throw new Error(data.message || 'Server error');
            updateCartCount(data.cartCount);
        } catch (error) {
            console.error('Error adding to cart:', error);
        } finally {
             setTimeout(() => {
                buttonElement.textContent = originalText;
                buttonElement.disabled = false;
            }, 500);
        }
    }
    
    async function updateCartItem(itemId, quantity) {
        if (quantity < 1) {
            return removeFromCart(itemId);
        }
        try {
            await fetch(`/api/cart/${itemId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ quantity })
            });
            loadCart();
        } catch (error) {
            console.error('Error updating cart item:', error);
        }
    }
    
    async function removeFromCart(itemId) {
        try {
            const response = await fetch(`/api/cart/${itemId}`, { method: 'DELETE' });
            const data = await response.json();
            updateCartCount(data.cartCount);
            loadCart();
        } catch (error) {
            console.error('Error removing from cart:', error);
        }
    }
    
    async function loadCart() {
        // Only try to load cart if the cart sidebar exists on the page
        if (!cartSidebar) return;
        try {
            const response = await fetch('/api/cart');
            if (response.status === 401) {
                // If user is not logged in, don't try to render a cart
                console.log('User not logged in, not loading cart.');
                renderCart({ items: [], total: '0.00', count: 0 }); // Render an empty cart state
                return;
            }
            const cartData = await response.json();
            if (cartData.success) {
                renderCart(cartData);
                updateCartCount(cartData.count);
            }
        } catch (error) {
            // This catch block will handle network errors or if the user is logged out (401 response)
            console.error('Error loading cart:', error);
        }
    }
    
    function renderCart(cartData) {
        const emptyCartHTML = `<div class="text-center text-muted-foreground py-8"><i class="fas fa-shopping-cart text-4xl mb-4"></i><p>Your cart is empty</p></div>`;

        if (!cartItemsContainer || !cartFooter) return;
        
        if (cartData.items.length === 0) {
            cartItemsContainer.innerHTML = emptyCartHTML;
            cartFooter.style.display = 'none';
        } else {
            const itemsHtml = cartData.items.map(item => {
                if (!item.product) return '';
                const itemId = item._id; 
                return `
                    <div class="flex items-center space-x-4 pb-4 border-b border-border mb-4">
                        <img src="${item.product.image}" alt="${item.product.name}" class="w-16 h-16 rounded-lg object-cover" />
                        <div class="flex-1">
                            <h4 class="font-semibold">${item.product.name}</h4>
                            <div class="flex items-center justify-between mt-2">
                                <div class="flex items-center space-x-2">
                                    <button class="w-6 h-6 rounded-full border flex items-center justify-center quantity-decrease" data-item-id="${itemId}">-</button>
                                    <span>${item.quantity}</span>
                                    <button class="w-6 h-6 rounded-full border flex items-center justify-center quantity-increase" data-item-id="${itemId}">+</button>
                                </div>
                                <div class="flex items-center space-x-2">
                                    <span class="font-bold text-primary">₹${(parseFloat(item.product.price) * item.quantity).toFixed(2)}</span>
                                    <button class="text-destructive hover:text-red-500 remove-item" data-item-id="${itemId}" title="Remove item"><i class="fas fa-trash text-sm"></i></button>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');
            cartItemsContainer.innerHTML = itemsHtml;
            cartFooter.style.display = 'block';
            if(cartTotalEl) cartTotalEl.textContent = `${cartData.total}`;
        }
    }
    
    function updateCartCount(count) {
        if (cartCountEl) cartCountEl.textContent = count;
        if (mobileCartCountEl) mobileCartCountEl.textContent = count;
    }

    // NEW FOR PHASE 3: Function to handle the checkout process
    async function handleCheckout() {
        const checkoutBtn = document.querySelector('[data-testid="button-checkout"]');
        checkoutBtn.disabled = true;
        checkoutBtn.textContent = 'Processing...';

        try {
            const response = await fetch('/api/orders/checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
            });

            const data = await response.json();

            if (response.ok) {
                // Success! Redirect to the new order details page.
                window.location.href = `/orders/${data.orderId}`;
            } else {
                // If there's an error from the server (e.g., out of stock), show it to the user.
                alert(data.message || 'An error occurred during checkout.');
                checkoutBtn.disabled = false;
                checkoutBtn.textContent = 'Proceed to Checkout';
            }
        } catch (error) {
            console.error('Checkout error:', error);
            alert('A network error occurred. Please try again.');
            checkoutBtn.disabled = false;
            checkoutBtn.textContent = 'Proceed to Checkout';
        }
    }
})();
