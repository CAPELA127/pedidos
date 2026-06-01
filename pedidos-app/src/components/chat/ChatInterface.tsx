"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Send, Check, MoreVertical, Phone, ShoppingCart, Search, UserPlus, X, Camera, Upload } from 'lucide-react';
import ProductCard from '../ProductCard';
import { normalizeAddress, validatePhoneNumber } from '@/lib/normalize-address';

interface OrderItem {
  itemId: string;
  ref: string;
  name: string;
  quantity: number;
  price?: number;
  notes?: string;
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
  | 'awaiting_vendor'
  | 'awaiting_search'
  | 'confirming_customer'
  | 'awaiting_tipo_id'
  | 'awaiting_cc_nit'
  | 'awaiting_primer_nombre'
  | 'awaiting_segundo_nombre'
  | 'awaiting_primer_apellido'
  | 'awaiting_segundo_apellido'
  | 'awaiting_phone'
  | 'awaiting_telefono_2'
  | 'awaiting_email'
  | 'awaiting_city'
  | 'awaiting_departamento'
  | 'awaiting_address'
  | 'ready';

interface CustomerData {
  name: string;
  email: string;
  ccNit?: string;
  tipoIdentificacion?: string;
  primerNombre?: string;
  segundoNombre?: string;
  primerApellido?: string;
  segundoApellido?: string;
  alias?: string;
  phone?: string;
  telefono2?: string;
  localName?: string;
  city?: string;
  departamento?: string;
  pais?: string;
  neighborhood?: string;
  address?: string;
  id?: string;
}

interface CustomerSearchResult {
  id: string;
  name: string;
  email?: string;
  cc_nit?: string;
  tipo_identificacion?: string;
  primer_nombre?: string;
  segundo_nombre?: string;
  primer_apellido?: string;
  segundo_apellido?: string;
  alias?: string;
  phone?: string;
  telefono_2?: string;
  local_name?: string;
  city?: string;
  departamento?: string;
  pais?: string;
  neighborhood?: string;
  address?: string;
}

export default function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [conversationState, setConversationState] = useState<ConversationState>('awaiting_vendor');
  const [vendorName, setVendorName] = useState('');
  const [customerData, setCustomerData] = useState<CustomerData>({ name: '', email: '' });
  const [selectedImage, setSelectedImage] = useState<{ url: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<CustomerSearchResult[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [activeProduct, setActiveProduct] = useState<{ imageUrl: string; ref: string; name: string; price?: number; quantity?: number } | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [modalDeliveryAddress, setModalDeliveryAddress] = useState('');
  const [modalNotes, setModalNotes] = useState('');
  const [showCartDrawer, setShowCartDrawer] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
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
      content: '¡Hola! 👋 ¿Cuál es tu nombre? (vendedor)',
      timestamp: new Date()
    }]);
  }, []);

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
      email: customer.email || '',
      ccNit: customer.cc_nit,
      tipoIdentificacion: customer.tipo_identificacion,
      primerNombre: customer.primer_nombre,
      segundoNombre: customer.segundo_nombre,
      primerApellido: customer.primer_apellido,
      segundoApellido: customer.segundo_apellido,
      alias: customer.alias,
      phone: customer.phone,
      telefono2: customer.telefono_2,
      localName: customer.local_name,
      city: customer.city,
      departamento: customer.departamento,
      pais: customer.pais,
      neighborhood: customer.neighborhood,
      address: customer.address,
    });

    const tipoLabel = customer.tipo_identificacion || 'CC/NIT';
    const lines = [
      `✅ Cliente encontrado:`,
      `👤 ${customer.name}${customer.alias ? ` (${customer.alias})` : ''}`,
      customer.cc_nit ? `🆔 ${tipoLabel}: ${customer.cc_nit}` : null,
      customer.phone ? `📱 ${customer.phone}${customer.telefono_2 ? ` / ${customer.telefono_2}` : ''}` : null,
      (customer.city || customer.departamento)
        ? `📍 ${[customer.city, customer.departamento].filter(Boolean).join(', ')}`
        : null,
      customer.address ? `🏠 ${customer.address}` : null,
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
      content: '¿Tipo de identificación? (CC, NIT, CE, Pasaporte)',
      timestamp: new Date()
    }]);
    setConversationState('awaiting_tipo_id');
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
        const { ref, name, price, quantity } = data.data;
        const notInInventory = data.warning;
        const timeLabel = processingTime > 1000 ? `(${(processingTime / 1000).toFixed(1)}s)` : '✨';

        const quantityLabel = quantity ? ` · ${quantity} und` : '';
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          type: 'bot',
          content: notInInventory
            ? `✨ Producto detectado (${ref})${quantityLabel} ${timeLabel}\n⚠️ No en inventario - puedes agregarlo igualmente`
            : `✨ ${name} (${ref})${quantityLabel} ${timeLabel}`,
          timestamp: new Date()
        }]);

        setActiveProduct({ imageUrl: url, ref, name, price, quantity });
      } else {
        // Si el servidor devolvió un error de API (no de imagen), mostrar mensaje distinto
        const isApiError = !res.ok || (data.error && !data.error.includes('referencia'));
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          type: 'bot',
          content: isApiError
            ? '❌ Error al procesar la imagen. Por favor intenta de nuevo.'
            : '❌ Imagen poco clara. Asegúrate de que:\n• El código esté visible\n• Buena iluminación\n• Foto enfocada\n\nIntenta de nuevo.',
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

    // ── VENDEDOR ──
    if (conversationState === 'awaiting_vendor') {
      const name = inputText.trim();
      setMessages(prev => [...prev,
        { id: Date.now().toString(), type: 'user', content: name, timestamp: new Date() },
        { id: (Date.now() + 1).toString(), type: 'bot', content: `¡Listo, ${name}! 👍 Ahora busca el cliente por NIT/CC o nombre, o regístralo como nuevo.`, timestamp: new Date() }
      ]);
      setVendorName(name);
      setConversationState('awaiting_search');
      setInputText('');
      return;
    }

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

    // ── TIPO IDENTIFICACIÓN ──
    if (conversationState === 'awaiting_tipo_id') {
      const tipoIdentificacion = inputText.trim().toUpperCase();
      setMessages(prev => [...prev, { id: Date.now().toString(), type: 'user', content: tipoIdentificacion, timestamp: new Date() }]);
      setCustomerData(prev => ({ ...prev, tipoIdentificacion }));
      setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), type: 'bot', content: '¿Cuál es tu número de identificación?', timestamp: new Date() }]);
      setConversationState('awaiting_cc_nit');
      setInputText('');
      return;
    }

    // ── CC/NIT ──
    if (conversationState === 'awaiting_cc_nit') {
      const ccNit = inputText.trim();
      setMessages(prev => [...prev, { id: Date.now().toString(), type: 'user', content: ccNit, timestamp: new Date() }]);
      setCustomerData(prev => ({ ...prev, ccNit }));
      setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), type: 'bot', content: '¿Cuál es tu primer nombre?', timestamp: new Date() }]);
      setConversationState('awaiting_primer_nombre');
      setInputText('');
      return;
    }

    // ── PRIMER NOMBRE ──
    if (conversationState === 'awaiting_primer_nombre') {
      const primerNombre = inputText.trim();
      setMessages(prev => [...prev, { id: Date.now().toString(), type: 'user', content: primerNombre, timestamp: new Date() }]);
      setCustomerData(prev => ({ ...prev, primerNombre }));
      setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), type: 'bot', content: '¿Segundo nombre? (escribe "no" si no tienes)', timestamp: new Date() }]);
      setConversationState('awaiting_segundo_nombre');
      setInputText('');
      return;
    }

    // ── SEGUNDO NOMBRE (opcional) ──
    if (conversationState === 'awaiting_segundo_nombre') {
      const input = inputText.trim();
      const segundoNombre = /^(no|ninguno|n\/a|-)$/i.test(input) ? undefined : input;
      setMessages(prev => [...prev, { id: Date.now().toString(), type: 'user', content: input, timestamp: new Date() }]);
      setCustomerData(prev => ({ ...prev, segundoNombre }));
      setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), type: 'bot', content: '¿Primer apellido?', timestamp: new Date() }]);
      setConversationState('awaiting_primer_apellido');
      setInputText('');
      return;
    }

    // ── PRIMER APELLIDO ──
    if (conversationState === 'awaiting_primer_apellido') {
      const primerApellido = inputText.trim();
      setMessages(prev => [...prev, { id: Date.now().toString(), type: 'user', content: primerApellido, timestamp: new Date() }]);
      setCustomerData(prev => ({ ...prev, primerApellido }));
      setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), type: 'bot', content: '¿Segundo apellido? (escribe "no" si no tienes)', timestamp: new Date() }]);
      setConversationState('awaiting_segundo_apellido');
      setInputText('');
      return;
    }

    // ── SEGUNDO APELLIDO (opcional) ──
    if (conversationState === 'awaiting_segundo_apellido') {
      const input = inputText.trim();
      const segundoApellido = /^(no|ninguno|n\/a|-)$/i.test(input) ? undefined : input;
      setMessages(prev => [...prev, { id: Date.now().toString(), type: 'user', content: input, timestamp: new Date() }]);
      setCustomerData(prev => ({ ...prev, segundoApellido }));
      setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), type: 'bot', content: '¿Teléfono principal? (ej: 3115555555)', timestamp: new Date() }]);
      setConversationState('awaiting_phone');
      setInputText('');
      return;
    }

    // ── TELÉFONO 1 ──
    if (conversationState === 'awaiting_phone') {
      const phone = inputText.trim();
      if (!validatePhoneNumber(phone)) {
        setMessages(prev => [...prev, { id: Date.now().toString(), type: 'bot', content: '❌ Teléfono inválido. Debe tener 10-15 dígitos.', timestamp: new Date() }]);
        setInputText('');
        return;
      }
      setMessages(prev => [...prev, { id: Date.now().toString(), type: 'user', content: phone, timestamp: new Date() }]);
      setCustomerData(prev => ({ ...prev, phone }));
      setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), type: 'bot', content: '¿Teléfono secundario? (escribe "no" si no tienes)', timestamp: new Date() }]);
      setConversationState('awaiting_telefono_2');
      setInputText('');
      return;
    }

    // ── TELÉFONO 2 (opcional) ──
    if (conversationState === 'awaiting_telefono_2') {
      const input = inputText.trim();
      const telefono2 = /^(no|ninguno|n\/a|-)$/i.test(input) ? undefined : input;
      setMessages(prev => [...prev, { id: Date.now().toString(), type: 'user', content: input, timestamp: new Date() }]);
      setCustomerData(prev => ({ ...prev, telefono2 }));
      setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), type: 'bot', content: '¿Cuál es tu email? (escribe "no" si no tienes)', timestamp: new Date() }]);
      setConversationState('awaiting_email');
      setInputText('');
      return;
    }

    // ── EMAIL (opcional) ──
    if (conversationState === 'awaiting_email') {
      const input = inputText.trim();
      if (!/^(no|ninguno|n\/a|-)$/i.test(input) && (!input.includes('@') || !input.includes('.'))) {
        setMessages(prev => [...prev, { id: Date.now().toString(), type: 'bot', content: '❌ Email inválido. Usa formato usuario@ejemplo.com o escribe "no"', timestamp: new Date() }]);
        setInputText('');
        return;
      }
      const email = /^(no|ninguno|n\/a|-)$/i.test(input) ? '' : input;
      setMessages(prev => [...prev, { id: Date.now().toString(), type: 'user', content: input, timestamp: new Date() }]);
      setCustomerData(prev => ({ ...prev, email }));
      setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), type: 'bot', content: '¿En qué ciudad estás?', timestamp: new Date() }]);
      setConversationState('awaiting_city');
      setInputText('');
      return;
    }

    // ── CIUDAD ──
    if (conversationState === 'awaiting_city') {
      const city = inputText.trim();
      setMessages(prev => [...prev, { id: Date.now().toString(), type: 'user', content: city, timestamp: new Date() }]);
      setCustomerData(prev => ({ ...prev, city }));
      setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), type: 'bot', content: '¿En qué departamento?', timestamp: new Date() }]);
      setConversationState('awaiting_departamento');
      setInputText('');
      return;
    }

    // ── DEPARTAMENTO ──
    if (conversationState === 'awaiting_departamento') {
      const departamento = inputText.trim();
      setMessages(prev => [...prev, { id: Date.now().toString(), type: 'user', content: departamento, timestamp: new Date() }]);
      setCustomerData(prev => ({ ...prev, departamento }));
      setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), type: 'bot', content: '¿Dirección completa? (ej: Cra 45 #95-23)', timestamp: new Date() }]);
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
        const fullName = [
          customerData.primerNombre,
          customerData.segundoNombre,
          customerData.primerApellido,
          customerData.segundoApellido,
        ].filter(Boolean).join(' ') || customerData.name;

        const payload = {
          name: fullName,
          email: customerData.email || null,
          cc_nit: customerData.ccNit,
          tipo_identificacion: customerData.tipoIdentificacion,
          primer_nombre: customerData.primerNombre,
          segundo_nombre: customerData.segundoNombre,
          primer_apellido: customerData.primerApellido,
          segundo_apellido: customerData.segundoApellido,
          phone: customerData.phone,
          telefono_2: customerData.telefono2,
          city: customerData.city,
          departamento: customerData.departamento,
          pais: 'Colombia',
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

        setCustomerData(prev => ({ ...prev, address, name: fullName, id: data.customer.id }));

        setMessages(prev => [...prev, {
          id: (Date.now() + 1).toString(),
          type: 'bot',
          content: `${data.customer.isNew ? `¡Bienvenido, ${fullName}! 🎉` : `¡Hola de nuevo, ${fullName}! 👋`} Sube las fotos de los productos y escribe la cantidad. 📦`,
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

  // ── Pegar imagen (Ctrl+V / ⌘V) ─────────────────────────────────────────────
  const handlePasteImage = (e: React.ClipboardEvent) => {
    if (conversationState !== 'ready' || isProcessing) return;
    const items = Array.from(e.clipboardData?.items ?? []);
    // Buscar imagen en items (formato directo: image/png, image/jpeg, etc.)
    const imageItem = items.find(item => item.type.startsWith('image/'));
    if (imageItem) {
      const file = imageItem.getAsFile();
      if (file) {
        e.preventDefault();
        e.stopPropagation();
        handleImageCapture(file);
        return;
      }
    }
    // Fallback: archivos en el portapapeles
    const files = Array.from(e.clipboardData?.files ?? []);
    const imageFile = files.find(f => f.type.startsWith('image/'));
    if (imageFile) {
      e.preventDefault();
      e.stopPropagation();
      handleImageCapture(imageFile);
    }
  };

  // ── Edición del carrito ─────────────────────────────────────────────────────
  const updateCartItemQuantity = (itemId: string, newQty: number) => {
    if (newQty <= 0) {
      setOrderItems(prev => prev.filter(i => i.itemId !== itemId));
    } else {
      setOrderItems(prev => prev.map(i => i.itemId === itemId ? { ...i, quantity: newQty } : i));
    }
  };

  const updateCartItemPrice = (itemId: string, newPrice: number) => {
    setOrderItems(prev => prev.map(i =>
      i.itemId === itemId ? { ...i, price: newPrice > 0 ? newPrice : undefined } : i
    ));
  };

  const removeCartItem = (itemId: string) => {
    setOrderItems(prev => prev.filter(i => i.itemId !== itemId));
  };

  // ── Drag & Drop ─────────────────────────────────────────────────────────────
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (conversationState === 'ready' && !isProcessing) setIsDraggingOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    // Solo quitar el estado si salimos del área completa (no de un hijo)
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDraggingOver(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
    if (conversationState !== 'ready' || isProcessing) return;
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      handleImageCapture(file);
    }
  };

  const addToOrder = (ref: string, name: string, quantity: number, price?: number, notes?: string) => {
    setOrderItems(prev => {
      const notesKey = (notes || '').trim().toLowerCase();
      const existing = prev.find(i => i.ref === ref && (i.notes || '').trim().toLowerCase() === notesKey);
      if (existing) return prev.map(i => i.itemId === existing.itemId ? { ...i, quantity: i.quantity + quantity } : i);
      return [...prev, { itemId: `${ref}_${Date.now()}`, ref, name, quantity, price, notes: notes || undefined }];
    });
    const label = notes ? `${name} (${notes})` : name;
    const priceLabel = price ? ` @ COP $${price.toLocaleString('es-CO')}` : '';
    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      type: 'system',
      content: `✅ Agregado: ${quantity} und de ${label}${priceLabel}`,
      timestamp: new Date()
    }]);
  };

  const handleProductCardAdd = (quantity: number, price: number, name: string, notes?: string) => {
    if (!activeProduct) return;
    const notesKey = (notes || '').trim().toLowerCase();
    setOrderItems(prev => {
      const existing = prev.find(i =>
        i.ref === activeProduct.ref && (i.notes || '').trim().toLowerCase() === notesKey
      );
      if (existing) {
        return prev.map(i => i.itemId === existing.itemId ? { ...i, name, quantity, price, notes: notes || undefined } : i);
      }
      return [...prev, { itemId: `${activeProduct.ref}_${Date.now()}`, ref: activeProduct.ref, name, quantity, price, notes: notes || undefined }];
    });
    const label = notes ? `${name} (${notes})` : name;
    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      type: 'system',
      content: `✅ ${label}: ${quantity} und @ COP $${price.toLocaleString('es-CO')}`,
      timestamp: new Date()
    }]);
    setActiveProduct(null);
  };

  const handleConfirmOrder = async (deliveryAddress?: string, orderNotes?: string) => {
    setIsSending(true);
    setShowConfirmModal(false);
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
          vendor_name: vendorName || undefined,
          delivery_address: deliveryAddress?.trim() || undefined,
          notes: orderNotes?.trim() || undefined,
          items: orderItems.map(i => ({
            ref: i.ref,
            name: i.notes ? `${i.name} (${i.notes})` : i.name,
            quantity: i.quantity,
            price: i.price,
          })),
          status: 'Pendiente',
          date: new Date().toLocaleDateString('es-ES'),
          total_items: orderItems.reduce((sum, i) => sum + i.quantity, 0)
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          type: 'bot',
          content: `🎉 ¡Pedido ${data.order?.id || orderId} confirmado! La bodega lo está preparando.`,
          timestamp: new Date()
        }]);
        setOrderItems([]);
      } else {
        const errMsg = data?.message || data?.error || `HTTP ${res.status}`;
        console.error('Error confirmando pedido:', errMsg, data);
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          type: 'bot',
          content: `❌ Error al confirmar: ${errMsg}`,
          timestamp: new Date()
        }]);
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Error desconocido';
      console.error('handleConfirmOrder catch:', errMsg);
      setMessages(prev => [...prev, { id: Date.now().toString(), type: 'bot', content: `❌ Error al confirmar: ${errMsg}`, timestamp: new Date() }]);
    } finally {
      setIsSending(false);
    }
  };

  const inputPlaceholder =
    conversationState === 'awaiting_vendor' ? 'Tu nombre (vendedor)...' :
    conversationState === 'confirming_customer' ? 'sí / no...' :
    conversationState === 'awaiting_tipo_id' ? 'CC, NIT, CE, Pasaporte...' :
    conversationState === 'awaiting_cc_nit' ? 'Número de identificación...' :
    conversationState === 'awaiting_primer_nombre' ? 'Primer nombre...' :
    conversationState === 'awaiting_segundo_nombre' ? 'Segundo nombre (o "no")...' :
    conversationState === 'awaiting_primer_apellido' ? 'Primer apellido...' :
    conversationState === 'awaiting_segundo_apellido' ? 'Segundo apellido (o "no")...' :
    conversationState === 'awaiting_phone' ? 'Teléfono 1...' :
    conversationState === 'awaiting_telefono_2' ? 'Teléfono 2 (o "no")...' :
    conversationState === 'awaiting_email' ? 'Email (o "no")...' :
    conversationState === 'awaiting_city' ? 'Ciudad...' :
    conversationState === 'awaiting_departamento' ? 'Departamento...' :
    conversationState === 'awaiting_address' ? 'Dirección completa...' :
    'Cantidad, número o mensaje...';

  const showInput = conversationState !== 'awaiting_search';
  const showSearchPanel = conversationState !== 'ready' && conversationState !== 'awaiting_vendor';

  return (
    <div className="flex flex-col w-full bg-[#efeae2] relative overflow-x-hidden" style={{ height: '100dvh' }} onPaste={handlePasteImage}>
      {/* Header */}
      <header className="bg-[#00a884] text-white p-3 flex items-center justify-between z-10 shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center font-bold text-lg">B</div>
          <div>
            <h1 className="font-semibold leading-tight">Bodega Principal</h1>
            <p className="text-xs text-white/80">
              {vendorName ? `Vendedor: ${vendorName}` : 'en línea'}
            </p>
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
                placeholder="Buscar por NIT, CC o nombre del cliente..."
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
                              {[customer.city, customer.departamento].filter(Boolean).join(', ')}
                            </p>
                          </div>
                          {customer.cc_nit && (
                            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full whitespace-nowrap flex-shrink-0">
                              {customer.tipo_identificacion ? `${customer.tipo_identificacion} ` : ''}{customer.cc_nit}
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
        className={`flex-1 overflow-y-auto p-3 space-y-3 flex flex-col relative transition-all ${isDraggingOver ? 'ring-4 ring-inset ring-[#00a884]' : ''}`}
        style={{ backgroundImage: 'url("https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png")', backgroundRepeat: 'repeat', backgroundSize: '400px' }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Overlay drag & drop */}
        {isDraggingOver && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#00a884]/15 z-10 pointer-events-none">
            <div className="bg-white rounded-2xl px-8 py-5 shadow-xl text-center border-2 border-dashed border-[#00a884]">
              <Upload size={36} className="text-[#00a884] mx-auto mb-2" />
              <p className="text-sm font-bold text-[#00a884]">Suelta la imagen aquí</p>
              <p className="text-xs text-gray-400 mt-0.5">JPG, PNG, WEBP</p>
            </div>
          </div>
        )}
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
          <div className="flex justify-center mt-4 px-2">
            <ProductCard
              imageUrl={activeProduct.imageUrl}
              productRef={activeProduct.ref}
              name={activeProduct.name}
              price={activeProduct.price}
              initialQuantity={activeProduct.quantity}
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
        <button
          onClick={() => orderItems.length > 0 && setShowCartDrawer(true)}
          className={`flex items-center gap-1.5 text-sm text-gray-600 ${orderItems.length > 0 ? 'active:scale-95 transition-transform cursor-pointer' : 'cursor-default'}`}
        >
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
          {orderItems.length > 0 && (
            <span className="text-[10px] text-gray-400 ml-1 underline underline-offset-2">editar</span>
          )}
        </button>
        <button
          onClick={() => {
            if (orderItems.length === 0 || conversationState !== 'ready') return;
            setModalDeliveryAddress('');
            setModalNotes('');
            setShowConfirmModal(true);
          }}
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

      {/* Bottom bar — cámara + archivo + texto + enviar en una sola fila */}
      <div
        className="bg-[#f0f2f5] px-3 pt-2 pb-3 flex-shrink-0"
        style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}
      >
        {/* Hint pegar imagen — solo en estado ready */}
        {conversationState === 'ready' && !isProcessing && (
          <p className="text-center text-[10px] text-gray-400 mb-1.5 select-none">
            📋 Ctrl+V para pegar imagen · arrastra y suelta · o usa los botones
          </p>
        )}
        <div className="flex items-center gap-2">
          {/* Botones de imagen (solo cuando ready) */}
          {conversationState === 'ready' && (
            <>
              {/* Cámara — abre cámara directamente en móvil */}
              <label
                htmlFor={isProcessing ? undefined : 'chat-cam-input'}
                className={`p-2.5 bg-white rounded-full shadow-sm flex-shrink-0 ${isProcessing ? 'opacity-40' : 'cursor-pointer hover:bg-gray-100 active:scale-95'}`}
                title="Tomar foto"
              >
                <Camera size={20} className="text-gray-500" />
              </label>
              <input
                id="chat-cam-input"
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                disabled={isProcessing}
                onChange={e => {
                  const f = e.target.files?.[0];
                  if (f) { handleImageCapture(f); e.target.value = ''; }
                }}
              />

              {/* Archivo / galería */}
              <label
                htmlFor={isProcessing ? undefined : 'chat-file-input'}
                className={`p-2.5 bg-white rounded-full shadow-sm flex-shrink-0 ${isProcessing ? 'opacity-40' : 'cursor-pointer hover:bg-gray-100 active:scale-95'}`}
                title="Subir archivo"
              >
                <Upload size={20} className="text-gray-500" />
              </label>
              <input
                id="chat-file-input"
                type="file"
                accept="image/*"
                className="hidden"
                disabled={isProcessing}
                onChange={e => {
                  const f = e.target.files?.[0];
                  if (f) { handleImageCapture(f); e.target.value = ''; }
                }}
              />
            </>
          )}

          {/* Input de texto */}
          {showInput && (
            <div className="flex-1 bg-white rounded-full px-4 py-2.5 shadow-sm flex items-center min-h-[44px]">
              <input
                type="text"
                placeholder={inputPlaceholder}
                className="w-full bg-transparent outline-none text-sm text-gray-800 placeholder-gray-400"
                value={inputText}
                onChange={e => setInputText(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSend()}
                onPaste={handlePasteImage}
                disabled={isProcessing}
              />
            </div>
          )}

          {/* Botón enviar */}
          {showInput && (
            <button
              onClick={handleSend}
              disabled={!inputText.trim() || isProcessing}
              className={`p-2.5 rounded-full shadow-sm flex-shrink-0 transition-all ${
                inputText.trim() && !isProcessing
                  ? 'bg-[#00a884] text-white hover:bg-[#008f6f] active:scale-95'
                  : 'bg-[#00a884] text-white opacity-40 cursor-not-allowed'
              }`}
            >
              <Send size={20} />
            </button>
          )}
        </div>
      </div>

      {/* Cart Drawer — editar ítems del pedido */}
      {showCartDrawer && (
        <div className="fixed inset-0 bg-black/40 z-40 flex items-end" onClick={() => setShowCartDrawer(false)}>
          <div
            className="bg-white w-full rounded-t-2xl flex flex-col shadow-2xl"
            style={{ maxHeight: '78dvh' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3.5 border-b flex-shrink-0">
              <h3 className="font-bold text-gray-800 flex items-center gap-2">
                <ShoppingCart size={17} className="text-[#00a884]" />
                Mi pedido
                <span className="text-sm font-normal text-gray-500">
                  · {orderItems.reduce((s, i) => s + i.quantity, 0)} und
                </span>
              </h3>
              <button onClick={() => setShowCartDrawer(false)} className="p-1.5 hover:bg-gray-100 rounded-full">
                <X size={18} className="text-gray-500" />
              </button>
            </div>

            {/* Lista editable */}
            <div className="overflow-y-auto flex-1 divide-y divide-gray-100">
              {orderItems.map(item => (
                <div key={item.itemId} className="px-4 py-3 flex flex-col gap-2">
                  {/* Nombre + eliminar */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-800 leading-snug truncate">
                        {item.name}
                      </p>
                      {item.notes && (
                        <p className="text-xs text-gray-400 truncate">{item.notes}</p>
                      )}
                      <p className="text-xs font-mono text-gray-400">REF: {item.ref}</p>
                    </div>
                    <button
                      onClick={() => removeCartItem(item.itemId)}
                      className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-full flex-shrink-0 transition-colors"
                      title="Eliminar"
                    >
                      <X size={15} />
                    </button>
                  </div>

                  {/* Controles cantidad + precio */}
                  <div className="flex items-center gap-3">
                    {/* Cantidad */}
                    <div className="flex items-center gap-1 bg-gray-100 rounded-full px-1 py-0.5">
                      <button
                        onClick={() => updateCartItemQuantity(item.itemId, item.quantity - 1)}
                        className="w-7 h-7 rounded-full bg-white shadow-sm flex items-center justify-center text-gray-700 font-bold hover:bg-gray-50 active:scale-95 transition-all text-base leading-none"
                      >−</button>
                      <span className="text-sm font-bold text-gray-800 min-w-[2rem] text-center tabular-nums">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => updateCartItemQuantity(item.itemId, item.quantity + 1)}
                        className="w-7 h-7 rounded-full bg-[#00a884] shadow-sm flex items-center justify-center text-white font-bold hover:bg-[#008f6f] active:scale-95 transition-all text-base leading-none"
                      >+</button>
                    </div>

                    <span className="text-gray-300">×</span>

                    {/* Precio */}
                    <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-[#00a884]">
                      <span className="px-2 text-xs text-gray-400 bg-gray-50 border-r border-gray-200 h-full flex items-center py-1.5">$</span>
                      <input
                        type="number"
                        value={item.price ?? ''}
                        onChange={e => updateCartItemPrice(item.itemId, parseFloat(e.target.value) || 0)}
                        placeholder="precio"
                        className="w-24 px-2 py-1.5 text-sm text-gray-800 outline-none bg-white tabular-nums"
                      />
                    </div>

                    {/* Subtotal */}
                    {item.price && (
                      <span className="text-sm font-semibold text-[#00a884] ml-auto tabular-nums whitespace-nowrap">
                        ${(item.price * item.quantity).toLocaleString('es-CO')}
                      </span>
                    )}
                  </div>
                </div>
              ))}

              {orderItems.length === 0 && (
                <div className="py-12 text-center text-gray-400">
                  <ShoppingCart size={32} className="mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Carrito vacío</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="border-t px-4 py-3 bg-gray-50 flex-shrink-0">
              {orderItems.some(i => i.price) && (
                <div className="flex justify-between items-center mb-3">
                  <span className="text-sm text-gray-600">Total del pedido</span>
                  <span className="font-bold text-[#00a884]">
                    COP ${orderItems.reduce((t, i) => t + ((i.price || 0) * i.quantity), 0).toLocaleString('es-CO')}
                  </span>
                </div>
              )}
              <button
                onClick={() => {
                  setShowCartDrawer(false);
                  setModalDeliveryAddress('');
                  setModalNotes('');
                  setShowConfirmModal(true);
                }}
                disabled={orderItems.length === 0}
                className="w-full py-3 bg-[#00a884] text-white rounded-xl font-semibold text-sm hover:bg-[#008f6f] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Confirmar pedido →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Confirmar Pedido */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-lg flex flex-col max-h-[92dvh]">

            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b flex-shrink-0">
              <div>
                <h2 className="text-base font-bold text-gray-800">Confirmar Pedido</h2>
                <p className="text-xs text-gray-400 mt-0.5">{customerData.name}</p>
              </div>
              <button onClick={() => setShowConfirmModal(false)} className="p-1.5 hover:bg-gray-100 rounded-full transition-colors">
                <X size={20} className="text-gray-500" />
              </button>
            </div>

            {/* Resumen de items */}
            <div className="px-5 py-3 overflow-y-auto flex-shrink-0 max-h-44 border-b bg-gray-50">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Resumen del pedido</p>
              <div className="space-y-1.5">
                {orderItems.map(item => (
                  <div key={item.itemId} className="flex justify-between items-center text-sm gap-2">
                    <span className="text-gray-700 truncate">
                      {item.notes ? `${item.name} (${item.notes})` : item.name}
                      <span className="text-gray-400 ml-1">×{item.quantity}</span>
                    </span>
                    {item.price
                      ? <span className="text-gray-500 flex-shrink-0 font-medium">${(item.price * item.quantity).toLocaleString('es-CO')}</span>
                      : <span className="text-gray-400 flex-shrink-0 text-xs">sin precio</span>
                    }
                  </div>
                ))}
              </div>
              {orderItems.some(i => i.price) && (
                <div className="flex justify-between font-bold text-sm border-t border-gray-200 pt-2 mt-2">
                  <span className="text-gray-700">Total</span>
                  <span className="text-[#00a884]">
                    COP ${orderItems.reduce((t, i) => t + ((i.price || 0) * i.quantity), 0).toLocaleString('es-CO')}
                  </span>
                </div>
              )}
            </div>

            {/* Campos adicionales */}
            <div className="px-5 py-4 space-y-4 overflow-y-auto">
              {/* Dirección diferente */}
              <div>
                <label className="text-xs font-semibold text-orange-600 block mb-1.5 flex items-center gap-1.5">
                  <span className="w-4 h-4 bg-orange-500 rounded-full inline-flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0">📍</span>
                  Dirección de entrega diferente
                  <span className="text-gray-400 font-normal">(opcional)</span>
                </label>
                <input
                  type="text"
                  value={modalDeliveryAddress}
                  onChange={e => setModalDeliveryAddress(e.target.value)}
                  placeholder={customerData.address ? `Por defecto: ${customerData.address}` : 'Ej: Cra 45 #95-23, Medellín'}
                  className="w-full px-3 py-2.5 border border-orange-200 bg-orange-50 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent placeholder:text-gray-400"
                />
              </div>

              {/* Notas adicionales */}
              <div>
                <label className="text-xs font-semibold text-yellow-700 block mb-1.5 flex items-center gap-1.5">
                  <span className="w-4 h-4 bg-yellow-400 rounded-full inline-flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0">📝</span>
                  Notas adicionales del pedido
                  <span className="text-gray-400 font-normal">(opcional)</span>
                </label>
                <textarea
                  value={modalNotes}
                  onChange={e => setModalNotes(e.target.value)}
                  placeholder="Instrucciones especiales, aclaraciones, variantes..."
                  rows={3}
                  className="w-full px-3 py-2.5 border border-yellow-200 bg-yellow-50 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent resize-none placeholder:text-gray-400"
                />
              </div>
            </div>

            {/* Acciones */}
            <div className="px-5 py-4 border-t bg-gray-50 rounded-b-2xl flex gap-3 flex-shrink-0">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="flex-1 py-2.5 border border-gray-300 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-100 active:scale-95 transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleConfirmOrder(modalDeliveryAddress, modalNotes)}
                disabled={isSending}
                className="flex-1 py-2.5 bg-[#00a884] text-white rounded-xl text-sm font-semibold hover:bg-[#008f6f] active:scale-95 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isSending ? 'Enviando...' : '✓ Confirmar Pedido'}
              </button>
            </div>
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
