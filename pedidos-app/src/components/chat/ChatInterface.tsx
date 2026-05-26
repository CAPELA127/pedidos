"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Send, Check, MoreVertical, Phone, ShoppingCart, Search, UserPlus, X } from 'lucide-react';
import ImageCapture from '../ImageCapture';
import ProductCard from '../ProductCard';
import { normalizeAddress, validatePhoneNumber } from '@/lib/normalize-address';

interface OrderItem {
  ref: string;
  name: string;
  quantity: number;
  price?: number;
}

interface Message {
  id: string;
  type: 'user' | 'system' | 'bot';
  content?: string;
  imageUrl?: string;
  timestamp: Date;
  metadata?: { ref?: string; name?: string; price?: number; pendingQuantity?: boolean; pendingPriceConfirm?: boolean };
}

type ConversationState =
  | 'awaiting_search'
  | 'confirming_customer'
  | 'awaiting_cc_nit'
  | 'awaiting_name'
  | 'awaiting_email'
  | 'awaiting_phone'
  | 'awaiting_local'
  | 'awaiting_city'
  | 'awaiting_neighborhood'
  | 'awaiting_address'
  | 'ready';

interface CustomerData {
  name: string;
  email: string;
  ccNit?: string;
  phone?: string;
  localName?: string;
  city?: string;
  neighborhood?: string;
  address?: string;
  id?: string;
}

interface CustomerSearchResult {
  id: string;
  name: string;
  email: string;
  cc_nit?: string;
  phone?: string;
  local_name?: string;
  city?: string;
  neighborhood?: string;
  address?: string;
}

export default function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [conversationState, setConversationState] = useState<ConversationState>('awaiting_search');
  const [customerData, setCustomerData] = useState<CustomerData>({ name: '', email: '' });
  const [selectedImage, setSelectedImage] = useState<{ url: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<CustomerSearchResult[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [activeProduct, setActiveProduct] = useState<{ imageUrl: string; ref: string; name: string; price?: number } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    setMessages([{
      id: '1',
      type: 'bot',
      content: '¡Hola! 👋 Busca tu perfil por CC/NIT o nombre en la barra de arriba, o regístrate como nuevo cliente.',
      timestamp: new Date()
    }]);
  }, []);

  // Cerrar dropdown al click fuera
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearchInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);

    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    if (value.length < 2) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }

    setSearchLoading(true);
    setShowDropdown(true);

    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/customers?q=${encodeURIComponent(value)}`);
        const data = await res.json();
        setSearchResults(data.customers || []);
      } catch {
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 400);
  };

  const handleSelectCustomer = (customer: CustomerSearchResult) => {
    setShowDropdown(false);
    setSearchQuery('');

    setCustomerData({
      id: customer.id,
      name: customer.name,
      email: customer.email,
      ccNit: customer.cc_nit,
      phone: customer.phone,
      localName: customer.local_name,
      city: customer.city,
      neighborhood: customer.neighborhood,
      address: customer.address,
    });

    const lines = [
      `✅ Perfil encontrado:`,
      `👤 ${customer.name}`,
      customer.cc_nit ? `🆔 CC/NIT: ${customer.cc_nit}` : null,
      customer.phone ? `📱 ${customer.phone}` : null,
      customer.local_name ? `🏪 ${customer.local_name}` : null,
      (customer.city || customer.neighborhood)
        ? `📍 ${[customer.city, customer.neighborhood].filter(Boolean).join(', ')}`
        : null,
      ``,
      `¿Confirmas que este es tu perfil? (sí / no)`,
    ].filter(l => l !== null).join('\n');

    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      type: 'bot',
      content: lines,
      timestamp: new Date()
    }]);

    setConversationState('confirming_customer');
  };

  const handleNewCustomer = () => {
    setShowDropdown(false);
    setSearchQuery('');
    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      type: 'bot',
      content: '¿Cuál es tu CC o NIT?',
      timestamp: new Date()
    }]);
    setConversationState('awaiting_cc_nit');
  };

  const compressImageInBrowser = async (file: File): Promise<File> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const maxWidth = 1024;
          const maxHeight = 768;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > maxWidth) { height = Math.round((height * maxWidth) / width); width = maxWidth; }
          } else {
            if (height > maxHeight) { width = Math.round((width * maxHeight) / height); height = maxHeight; }
          }

          canvas.width = width;
          canvas.height = height;
          canvas.getContext('2d')?.drawImage(img, 0, 0, width, height);

          canvas.toBlob(
            (blob) => resolve(blob ? new File([blob], file.name, { type: 'image/jpeg' }) : file),
            'image/jpeg',
            0.75
          );
        };
      };
    });
  };

  const handleImageCapture = async (file: File) => {
    const ocrStartTime = Date.now();
    const compressedFile = await compressImageInBrowser(file);
    const url = URL.createObjectURL(compressedFile);

    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      type: 'user',
      imageUrl: url,
      timestamp: new Date()
    }]);

    setIsProcessing(true);
    const loadingMsgId = 'ocr-loading-' + Date.now();
    setMessages(prev => [...prev, {
      id: loadingMsgId,
      type: 'bot',
      content: '🔍 Analizando imagen...',
      timestamp: new Date()
    }]);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 45000);

      const formData = new FormData();
      formData.append('image', compressedFile);

      const res = await fetch('/api/ocr', {
        method: 'POST',
        body: formData,
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      const data = await res.json();
      const processingTime = data.processingTime || (Date.now() - ocrStartTime);

      setMessages(prev => prev.filter(m => m.id !== loadingMsgId));

      if (data.success && data.data?.ref) {
        const { ref, name, price } = data.data;
        const notInInventory = data.warning;
        const timeLabel = processingTime > 1000 ? `(${(processingTime / 1000).toFixed(1)}s)` : '✨';

        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          type: 'bot',
          content: notInInventory ? `✨ Producto detectado (${ref}) ${timeLabel}\n⚠️ No en inventario - puedes agregarlo igualmente` : `✨ ${name} (${ref}) ${timeLabel}`,
          timestamp: new Date()
        }]);

        // Mostrar card interactivo en lugar de flujo de chat
        setActiveProduct({ imageUrl: url, ref, name, price });
      } else {
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          type: 'bot',
          content: '❌ Imagen poco clara. Asegúrate de que:\n• El código esté visible\n• Buena iluminación\n• Foto enfocada\n\nIntenta de nuevo.',
          timestamp: new Date()
        }]);
      }
    } catch (error) {
      setMessages(prev => prev.filter(m => m.id !== loadingMsgId));
      const errorMessage = error instanceof Error
        ? (error.name === 'AbortError' ? 'El OCR tardó demasiado. Asegúrate que la imagen sea clara.' : error.message)
        : 'Error procesando imagen';
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        type: 'bot',
        content: `❌ ${errorMessage}`,
        timestamp: new Date()
      }]);
    } finally {
      setIsProcessing(false);
      URL.revokeObjectURL(url);
    }
  };

  const handleSend = async () => {
    if (!inputText.trim()) return;

    // ── CONFIRMAR CLIENTE EXISTENTE ──
    if (conversationState === 'confirming_customer') {
      const resp = inputText.trim();
      setMessages(prev => [...prev, { id: Date.now().toString(), type: 'user', content: resp, timestamp: new Date() }]);
      setInputText('');

      if (/^(si|sí|s|ok|yes|y|claro|listo|dale|confirmo|correcto)$/i.test(resp)) {
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          type: 'bot',
          content: `¡Hola de nuevo, ${customerData.name}! 👋 Sube las fotos de los productos y escribe la cantidad. 📦`,
          timestamp: new Date()
        }]);
        setConversationState('ready');
      } else {
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          type: 'bot',
          content: 'Busca otro perfil arriba o regístrate como nuevo cliente.',
          timestamp: new Date()
        }]);
        setCustomerData({ name: '', email: '' });
        setConversationState('awaiting_search');
      }
      return;
    }

    // ── CC/NIT ──
    if (conversationState === 'awaiting_cc_nit') {
      const ccNit = inputText.trim();
      setMessages(prev => [...prev, { id: Date.now().toString(), type: 'user', content: ccNit, timestamp: new Date() }]);
      setCustomerData(prev => ({ ...prev, ccNit }));
      setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), type: 'bot', content: '¿Cuál es tu nombre?', timestamp: new Date() }]);
      setConversationState('awaiting_name');
      setInputText('');
      return;
    }

    // ── NOMBRE ──
    if (conversationState === 'awaiting_name') {
      const name = inputText.trim();
      setMessages(prev => [...prev, { id: Date.now().toString(), type: 'user', content: name, timestamp: new Date() }]);
      setCustomerData(prev => ({ ...prev, name }));
      setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), type: 'bot', content: `Perfecto, ${name}. ¿Cuál es tu email?`, timestamp: new Date() }]);
      setConversationState('awaiting_email');
      setInputText('');
      return;
    }

    // ── EMAIL ──
    if (conversationState === 'awaiting_email') {
      const email = inputText.trim();
      if (!email.includes('@') || !email.includes('.')) {
        setMessages(prev => [...prev, { id: Date.now().toString(), type: 'bot', content: '❌ Email inválido. Usa formato: usuario@ejemplo.com', timestamp: new Date() }]);
        setInputText('');
        return;
      }
      setMessages(prev => [...prev, { id: Date.now().toString(), type: 'user', content: email, timestamp: new Date() }]);
      setCustomerData(prev => ({ ...prev, email }));
      setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), type: 'bot', content: '¿Cuál es tu teléfono? (ej: 3115555555)', timestamp: new Date() }]);
      setConversationState('awaiting_phone');
      setInputText('');
      return;
    }

    // ── TELÉFONO ──
    if (conversationState === 'awaiting_phone') {
      const phone = inputText.trim();
      if (!validatePhoneNumber(phone)) {
        setMessages(prev => [...prev, { id: Date.now().toString(), type: 'bot', content: '❌ Teléfono inválido. Debe tener 10-15 dígitos.', timestamp: new Date() }]);
        setInputText('');
        return;
      }
      setMessages(prev => [...prev, { id: Date.now().toString(), type: 'user', content: phone, timestamp: new Date() }]);
      setCustomerData(prev => ({ ...prev, phone }));
      setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), type: 'bot', content: '¿Cuál es el nombre de tu local/negocio?', timestamp: new Date() }]);
      setConversationState('awaiting_local');
      setInputText('');
      return;
    }

    // ── LOCAL ──
    if (conversationState === 'awaiting_local') {
      const localName = inputText.trim();
      setMessages(prev => [...prev, { id: Date.now().toString(), type: 'user', content: localName, timestamp: new Date() }]);
      setCustomerData(prev => ({ ...prev, localName }));
      setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), type: 'bot', content: '¿En qué ciudad estás? (ej: Medellín)', timestamp: new Date() }]);
      setConversationState('awaiting_city');
      setInputText('');
      return;
    }

    // ── CIUDAD ──
    if (conversationState === 'awaiting_city') {
      const city = inputText.trim();
      setMessages(prev => [...prev, { id: Date.now().toString(), type: 'user', content: city, timestamp: new Date() }]);
      setCustomerData(prev => ({ ...prev, city }));
      setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), type: 'bot', content: '¿En qué barrio? (ej: Laureles)', timestamp: new Date() }]);
      setConversationState('awaiting_neighborhood');
      setInputText('');
      return;
    }

    // ── BARRIO ──
    if (conversationState === 'awaiting_neighborhood') {
      const neighborhood = inputText.trim();
      setMessages(prev => [...prev, { id: Date.now().toString(), type: 'user', content: neighborhood, timestamp: new Date() }]);
      setCustomerData(prev => ({ ...prev, neighborhood }));
      setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), type: 'bot', content: '¿Cuál es la dirección completa? (ej: Cra 45 #95-23)', timestamp: new Date() }]);
      setConversationState('awaiting_address');
      setInputText('');
      return;
    }

    // ── DIRECCIÓN + GUARDAR ──
    if (conversationState === 'awaiting_address') {
      const address = inputText.trim();
      setMessages(prev => [...prev, { id: Date.now().toString(), type: 'user', content: address, timestamp: new Date() }]);
      setIsProcessing(true);

      try {
        const payload = {
          name: customerData.name,
          email: customerData.email,
          cc_nit: customerData.ccNit,
          phone: customerData.phone,
          local_name: customerData.localName,
          city: customerData.city,
          neighborhood: customerData.neighborhood,
          address,
          address_normalized: normalizeAddress(address),
        };

        const response = await fetch('/api/customers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.message);

        setCustomerData(prev => ({ ...prev, address, id: data.customer.id }));

        setMessages(prev => [...prev, {
          id: (Date.now() + 1).toString(),
          type: 'bot',
          content: `${data.customer.isNew ? `¡Bienvenido, ${customerData.name}! 🎉` : `¡Hola de nuevo, ${customerData.name}! 👋`} Sube las fotos de los productos y escribe la cantidad. 📦`,
          timestamp: new Date()
        }]);
        setConversationState('ready');
      } catch (error) {
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          type: 'bot',
          content: `Error al registrar: ${error instanceof Error ? error.message : 'Intenta nuevamente'}`,
          timestamp: new Date()
        }]);
      } finally {
        setIsProcessing(false);
        setInputText('');
      }
      return;
    }

    const currentText = inputText.trim();
    setInputText('');

    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      type: 'user',
      content: currentText,
      timestamp: new Date()
    }]);

    // ── Confirmación de precio ──
    const pendingPriceBot = [...messages].reverse().find(m => m.type === 'bot' && m.metadata?.pendingPriceConfirm);

    if (pendingPriceBot?.metadata?.ref) {
      const isOk = /^(si|sí|ok|okay|s|vale|claro|listo|confirmado|yes|y)$/i.test(currentText.trim());
      const priceMatch = currentText.match(/\d{2,}/);
      const newPrice = priceMatch ? parseInt(priceMatch[0], 10) : null;

      if (isOk) {
        setMessages(prev => prev.map(m =>
          m.id === pendingPriceBot.id
            ? { ...m, metadata: { ...m.metadata, pendingPriceConfirm: false, pendingQuantity: true } }
            : m
        ));
        setMessages(prev => [...prev, { id: Date.now().toString(), type: 'bot', content: '✅ Perfecto. ¿Cuántas unidades?', timestamp: new Date() }]);
      } else if (newPrice && newPrice > 0) {
        setMessages(prev => prev.map(m =>
          m.id === pendingPriceBot.id
            ? { ...m, metadata: { ...m.metadata, price: newPrice, pendingPriceConfirm: false, pendingQuantity: true } }
            : m
        ));
        setMessages(prev => [...prev, { id: Date.now().toString(), type: 'bot', content: `✅ Precio actualizado a COP $${newPrice.toLocaleString('es-CO')}. ¿Cuántas unidades?`, timestamp: new Date() }]);
      } else {
        setMessages(prev => [...prev, { id: Date.now().toString(), type: 'bot', content: 'Escribe "sí" para confirmar o un número para cambiar el precio.', timestamp: new Date() }]);
      }
      return;
    }

    // ── Cantidad pendiente ──
    const pendingBot = [...messages].reverse().find(m => m.type === 'bot' && m.metadata?.pendingQuantity);

    if (pendingBot?.metadata?.ref) {
      const quantity = parseInt(currentText.match(/\d+/)?.[0] || '', 10);
      if (quantity > 0) {
        addToOrder(pendingBot.metadata.ref, pendingBot.metadata.name || 'Producto', quantity, pendingBot.metadata.price);
        setMessages(prev => prev.map(m =>
          m.id === pendingBot.id ? { ...m, metadata: { ...m.metadata, pendingQuantity: false } } : m
        ));
      } else {
        setMessages(prev => [...prev, { id: Date.now().toString(), type: 'bot', content: 'No entendí. Escribe un número, por ejemplo: 24', timestamp: new Date() }]);
      }
    }
  };

  const addToOrder = (ref: string, name: string, quantity: number, price?: number) => {
    setOrderItems(prev => {
      const existing = prev.find(i => i.ref === ref);
      if (existing) return prev.map(i => i.ref === ref ? { ...i, quantity: i.quantity + quantity } : i);
      return [...prev, { ref, name, quantity, price }];
    });
    const priceLabel = price ? ` @ COP $${price.toLocaleString('es-CO')}` : '';
    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      type: 'system',
      content: `✅ Agregado: ${quantity} und de ${name}${priceLabel}`,
      timestamp: new Date()
    }]);
  };

  const handleProductCardAdd = (quantity: number, price?: number) => {
    if (!activeProduct) return;
    addToOrder(activeProduct.ref, activeProduct.name, quantity, price);
    setActiveProduct(null);
  };

  const handleConfirmOrder = async () => {
    if (orderItems.length === 0) { alert('Agrega al menos un producto.'); return; }
    setIsSending(true);
    try {
      const orderId = `ORD-${Math.floor(1000 + Math.random() * 9000)}`;
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: orderId,
          customer: customerData.name,
          email: customerData.email,
          cc_nit: customerData.ccNit,
          phone: customerData.phone,
          local_name: customerData.localName,
          city: customerData.city,
          neighborhood: customerData.neighborhood,
          address: customerData.address,
          customer_id: customerData.id,
          items: orderItems,
          status: 'Pendiente',
          date: new Date().toLocaleDateString('es-ES'),
          total_items: orderItems.reduce((sum, i) => sum + i.quantity, 0)
        })
      });

      if (res.ok) {
        const data = await res.json();
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          type: 'bot',
          content: `🎉 ¡Pedido ${data.order?.id || orderId} confirmado! La bodega lo está preparando.`,
          timestamp: new Date()
        }]);
        setOrderItems([]);
      } else {
        throw new Error('Error en el servidor');
      }
    } catch {
      setMessages(prev => [...prev, { id: Date.now().toString(), type: 'bot', content: '❌ Error al confirmar. Intenta nuevamente.', timestamp: new Date() }]);
    } finally {
      setIsSending(false);
    }
  };

  const inputPlaceholder =
    conversationState === 'confirming_customer' ? 'sí / no...' :
    conversationState === 'awaiting_cc_nit' ? 'CC o NIT...' :
    conversationState === 'awaiting_name' ? 'Tu nombre...' :
    conversationState === 'awaiting_email' ? 'Tu email...' :
    conversationState === 'awaiting_phone' ? 'Teléfono...' :
    conversationState === 'awaiting_local' ? 'Nombre del local...' :
    conversationState === 'awaiting_city' ? 'Ciudad...' :
    conversationState === 'awaiting_neighborhood' ? 'Barrio...' :
    conversationState === 'awaiting_address' ? 'Dirección completa...' :
    'Cantidad, número o mensaje...';

  const showInput = conversationState !== 'awaiting_search';
  const showSearchPanel = conversationState !== 'ready';

  return (
    <div className="flex flex-col w-full bg-[#efeae2] relative overflow-hidden" style={{ height: '100dvh' }}>
      {/* Header */}
      <header className="bg-[#00a884] text-white p-3 flex items-center justify-between z-10 shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center font-bold text-lg">B</div>
          <div>
            <h1 className="font-semibold leading-tight">Bodega Principal</h1>
            <p className="text-xs text-white/80">en línea</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <Phone size={20} className="opacity-80" />
          <MoreVertical size={20} className="opacity-80" />
        </div>
      </header>

      {/* Search Panel */}
      {showSearchPanel && (
        <div className="bg-white border-b border-gray-100 px-3 py-2.5 z-10 shadow-sm" ref={searchRef}>
          <div className="relative">
            <div className="flex items-center gap-2 bg-gray-100 rounded-full px-3 py-2">
              <Search size={15} className="text-gray-400 flex-shrink-0" />
              <input
                type="text"
                placeholder="Buscar por CC/NIT o nombre del cliente..."
                value={searchQuery}
                onChange={handleSearchInput}
                onFocus={() => searchResults.length > 0 && setShowDropdown(true)}
                className="flex-1 bg-transparent outline-none text-sm text-gray-800 placeholder-gray-400"
              />
              {searchLoading && (
                <div className="w-4 h-4 border-2 border-gray-200 border-t-[#00a884] rounded-full animate-spin flex-shrink-0" />
              )}
              {searchQuery && !searchLoading && (
                <button onMouseDown={() => { setSearchQuery(''); setShowDropdown(false); setSearchResults([]); }}>
                  <X size={14} className="text-gray-400" />
                </button>
              )}
            </div>

            {/* Dropdown resultados */}
            {showDropdown && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-lg border border-gray-100 z-20 max-h-52 overflow-y-auto">
                {searchResults.length > 0 ? (
                  <>
                    {searchResults.map(customer => (
                      <button
                        key={customer.id}
                        onMouseDown={() => handleSelectCustomer(customer)}
                        className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-gray-50 last:border-0 transition-colors"
                      >
                        <div className="flex justify-between items-center gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-gray-800 truncate">{customer.name}</p>
                            <p className="text-xs text-gray-500 truncate">
                              {[customer.local_name, customer.city].filter(Boolean).join(' · ')}
                            </p>
                          </div>
                          {customer.cc_nit && (
                            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full whitespace-nowrap flex-shrink-0">
                              {customer.cc_nit}
                            </span>
                          )}
                        </div>
                      </button>
                    ))}
                    <button
                      onMouseDown={handleNewCustomer}
                      className="w-full text-center py-2.5 text-sm text-[#00a884] font-medium hover:bg-gray-50 transition-colors"
                    >
                      + Registrar nuevo cliente
                    </button>
                  </>
                ) : !searchLoading ? (
                  <div className="p-4 text-center">
                    <p className="text-sm text-gray-500 mb-2">Sin resultados para &ldquo;{searchQuery}&rdquo;</p>
                    <button onMouseDown={handleNewCustomer} className="text-sm text-[#00a884] font-semibold">
                      + Registrar como nuevo cliente
                    </button>
                  </div>
                ) : null}
              </div>
            )}
          </div>

          {conversationState === 'awaiting_search' && (
            <button
              onClick={handleNewCustomer}
              className="mt-2 flex items-center justify-center gap-1.5 text-xs text-[#00a884] font-medium w-full py-1 hover:underline"
            >
              <UserPlus size={13} />
              Registrar nuevo cliente
            </button>
          )}
        </div>
      )}

      {/* Chat Area */}
      <div
        className="flex-1 overflow-y-auto p-3 space-y-3 flex flex-col"
        style={{ backgroundImage: 'url("https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png")', backgroundRepeat: 'repeat', backgroundSize: '400px' }}
      >
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.type === 'user' ? 'justify-end' : msg.type === 'system' ? 'justify-center' : 'justify-start'}`}>
            {msg.type === 'system' ? (
              <div className="bg-[#fffde7] border border-yellow-200 text-gray-700 text-xs px-3 py-1.5 rounded-full shadow-sm">
                {msg.content}
              </div>
            ) : (
              <div className={`max-w-[82%] rounded-2xl px-3 py-2 shadow-sm ${msg.type === 'user' ? 'bg-[#d9fdd3] rounded-tr-sm' : 'bg-white rounded-tl-sm'}`}>
                {msg.imageUrl && (
                  <img
                    src={msg.imageUrl}
                    alt="Producto"
                    className="rounded-lg mb-1 max-h-72 w-auto object-contain cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={() => setSelectedImage({ url: msg.imageUrl! })}
                  />
                )}
                {msg.content && (
                  <p className="text-sm text-gray-800 whitespace-pre-wrap leading-snug">{msg.content}</p>
                )}
                <div className="flex justify-end items-center gap-1 mt-0.5">
                  <span className="text-[10px] text-gray-400">
                    {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  {msg.type === 'user' && <Check size={13} className="text-[#53bdeb]" />}
                </div>
              </div>
            )}
          </div>
        ))}

        {isProcessing && (
          <div className="flex justify-start">
            <div className="bg-white rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm flex gap-1.5 items-center">
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.15s' }} />
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }} />
              <span className="text-xs text-gray-400 ml-1">Analizando imagen...</span>
            </div>
          </div>
        )}

        {/* Product Card */}
        {activeProduct && (
          <div className="flex justify-center mt-4">
            <ProductCard
              imageUrl={activeProduct.imageUrl}
              ref={activeProduct.ref}
              name={activeProduct.name}
              price={activeProduct.price}
              onAddToCart={handleProductCardAdd}
              onClose={() => setActiveProduct(null)}
              loading={isProcessing}
            />
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Order Summary Bar */}
      <div className="bg-white border-t border-gray-100 px-3 py-2 flex justify-between items-center shadow-md flex-wrap gap-2">
        <div className="flex items-center gap-1.5 text-sm text-gray-600">
          <ShoppingCart size={16} className="text-[#00a884]" />
          <span className="font-medium text-[#00a884]">{orderItems.length}</span>
          <span>{orderItems.length === 1 ? 'producto' : 'productos'}</span>
          {orderItems.length > 0 && (
            <span className="text-gray-400">({orderItems.reduce((s, i) => s + i.quantity, 0)} und)</span>
          )}
          {orderItems.some(i => i.price) && (
            <span className="text-[#00a884] font-semibold ml-2">
              COP ${orderItems.reduce((total, i) => total + ((i.price || 0) * i.quantity), 0).toLocaleString('es-CO')}
            </span>
          )}
        </div>
        <button
          onClick={handleConfirmOrder}
          disabled={isSending || orderItems.length === 0 || conversationState !== 'ready'}
          className={`text-sm px-4 py-1.5 rounded-full font-semibold transition-all shadow-sm ${
            orderItems.length > 0 && conversationState === 'ready'
              ? 'bg-[#00a884] text-white hover:bg-[#008f6f] active:scale-95'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
          }`}
        >
          {isSending ? 'Enviando...' : 'Confirmar Pedido'}
        </button>
      </div>

      {/* Image Capture */}
      {conversationState === 'ready' && (
        <div className="bg-[#f0f2f5] px-2 pt-2">
          <ImageCapture onImageCapture={handleImageCapture} disabled={isProcessing} />
        </div>
      )}

      {/* Input Area */}
      {showInput && (
        <div className="bg-[#f0f2f5] px-2 pt-2 flex flex-col gap-2" style={{ paddingBottom: 'max(20px, env(safe-area-inset-bottom, 20px))' }}>
          <div className="flex items-end gap-2">
            <div className="flex-1 bg-white rounded-full px-4 py-2.5 flex items-center gap-2 shadow-sm min-h-[44px]">
              <input
                type="text"
                placeholder={inputPlaceholder}
                className="flex-1 bg-transparent outline-none text-sm text-gray-800 placeholder-gray-400"
                value={inputText}
                onChange={e => setInputText(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSend()}
                disabled={isProcessing}
              />
            </div>
            <button
              onClick={handleSend}
              disabled={!inputText.trim() || isProcessing}
              className={`p-3 rounded-full shadow-sm transition-all flex-shrink-0 ${
                inputText.trim() && !isProcessing
                  ? 'bg-[#00a884] text-white hover:bg-[#008f6f] active:scale-95'
                  : 'bg-[#00a884] text-white opacity-50 cursor-not-allowed'
              }`}
            >
              <Send size={20} />
            </button>
          </div>
        </div>
      )}

      {/* Modal Ver Imagen */}
      {selectedImage && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={() => setSelectedImage(null)}>
          <div className="relative bg-white rounded-2xl shadow-2xl max-w-2xl max-h-[90vh] flex items-center justify-center" onClick={e => e.stopPropagation()}>
            <button onClick={() => setSelectedImage(null)} className="absolute top-4 right-4 bg-white rounded-full p-2 shadow-lg hover:bg-gray-100 z-10">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <img src={selectedImage.url} alt="Vista ampliada" className="max-w-full max-h-[85vh] object-contain rounded-xl" />
            <div className="absolute bottom-4 left-4 right-4 bg-white/95 backdrop-blur rounded-lg p-3 flex gap-2 justify-between items-center">
              <span className="text-xs text-gray-600 font-medium">Click para cerrar</span>
              <button onClick={() => setSelectedImage(null)} className="bg-[#00a884] text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-[#008f6f]">Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
