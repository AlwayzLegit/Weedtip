import 'package:supabase_flutter/supabase_flutter.dart';

import 'models.dart';

/// Data access mirroring the web `@weedtip/supabase` queries. Search goes through
/// the same Postgres RPCs (search_dispensaries / search_products), so web and
/// mobile share one backend contract.
class WeedtipRepository {
  WeedtipRepository(this._c);
  final SupabaseClient _c;

  static const _dispensaryCols =
      'id,name,slug,city,state,description,cover_image_url,logo_url,is_medical,is_recreational,is_delivery,is_pickup,latitude,longitude,rating_avg,rating_count';

  Future<List<Dispensary>> featuredDispensaries() async {
    final rows = await _c
        .from('dispensaries')
        .select(_dispensaryCols)
        .eq('status', 'active')
        .order('featured', ascending: false)
        .order('created_at', ascending: false)
        .limit(8);
    return rows.map(Dispensary.fromJson).toList();
  }

  Future<List<Category>> categories() async {
    final rows = await _c.from('categories').select().order('sort_order');
    return rows.map(Category.fromJson).toList();
  }

  Future<List<Dispensary>> searchDispensaries({
    String? query,
    double? lat,
    double? lng,
    bool openNow = false,
    String? categorySlug,
  }) async {
    final rows = await _c.rpc('search_dispensaries', params: {
      'search_query': query,
      'lat': lat,
      'lng': lng,
      'radius_meters': 40000,
      'filter_open_now': openNow,
      'filter_category_slug': categorySlug,
      'result_limit': 40,
      'result_offset': 0,
    });
    return (rows as List).map((e) => Dispensary.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<Dispensary?> dispensaryBySlug(String slug) async {
    final row = await _c
        .from('dispensaries')
        .select(_dispensaryCols)
        .eq('slug', slug)
        .maybeSingle();
    return row == null ? null : Dispensary.fromJson(row);
  }

  Future<List<Product>> productsForDispensary(String dispensaryId) async {
    final rows = await _c
        .from('products')
        .select()
        .eq('dispensary_id', dispensaryId)
        .order('name');
    return rows.map(Product.fromJson).toList();
  }

  Future<List<Product>> searchProducts({
    String? query,
    String? categorySlug,
    String? strain,
  }) async {
    final rows = await _c.rpc('search_products', params: {
      'search_query': query,
      'filter_category_slug': categorySlug,
      'filter_strain': strain,
      'in_stock_only': true,
      'result_limit': 40,
      'result_offset': 0,
    });
    return (rows as List).map((e) => Product.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<List<Map<String, dynamic>>> reviewsForDispensary(String dispensaryId) async {
    final rows = await _c
        .from('reviews')
        .select('id,rating,body,created_at')
        .eq('dispensary_id', dispensaryId)
        .order('created_at', ascending: false);
    return rows.cast<Map<String, dynamic>>();
  }

  /// Place an order via the shared server-authoritative `create_order` RPC.
  /// `items` is [{ 'product_id': uuid, 'quantity': int }]. Returns the order id.
  Future<String> createOrder({
    required String dispensaryId,
    required String orderType,
    required List<Map<String, dynamic>> items,
    String? notes,
  }) async {
    final id = await _c.rpc('create_order', params: {
      'p_dispensary_id': dispensaryId,
      'p_order_type': orderType,
      'p_items': items,
      'p_notes': notes,
    });
    return id as String;
  }

  Future<List<Map<String, dynamic>>> myOrders() async {
    final rows = await _c
        .from('orders')
        .select('*, dispensary:dispensaries(name,slug)')
        .order('created_at', ascending: false);
    return rows.cast<Map<String, dynamic>>();
  }

  // ─── Favorites ─────────────────────────────────────────────────────────────

  Future<List<Dispensary>> favorites() async {
    final rows = await _c
        .from('favorites')
        .select('dispensary:dispensaries($_dispensaryCols)')
        .order('created_at', ascending: false);
    return rows
        .map((r) => r['dispensary'] as Map<String, dynamic>?)
        .whereType<Map<String, dynamic>>()
        .map(Dispensary.fromJson)
        .toList();
  }

  Future<bool> isFavorite(String dispensaryId) async {
    final uid = _c.auth.currentUser?.id;
    if (uid == null) return false;
    final row = await _c
        .from('favorites')
        .select('dispensary_id')
        .eq('user_id', uid)
        .eq('dispensary_id', dispensaryId)
        .maybeSingle();
    return row != null;
  }

  /// Returns the new favorited state.
  Future<bool> toggleFavorite(String dispensaryId) async {
    final uid = _c.auth.currentUser!.id;
    if (await isFavorite(dispensaryId)) {
      await _c.from('favorites').delete().eq('user_id', uid).eq('dispensary_id', dispensaryId);
      return false;
    }
    await _c.from('favorites').insert({'user_id': uid, 'dispensary_id': dispensaryId});
    return true;
  }

  // ─── Reviews / profile ─────────────────────────────────────────────────────

  Future<void> submitReview(String dispensaryId, int rating, String? body) async {
    final uid = _c.auth.currentUser!.id;
    await _c.from('reviews').upsert(
      {'dispensary_id': dispensaryId, 'user_id': uid, 'rating': rating, 'body': body},
      onConflict: 'dispensary_id,user_id',
    );
  }

  Future<Map<String, dynamic>?> myProfile() async {
    final uid = _c.auth.currentUser?.id;
    if (uid == null) return null;
    return _c.from('profiles').select().eq('id', uid).maybeSingle();
  }

  Future<void> updateProfile({String? displayName, String? dateOfBirth}) async {
    final uid = _c.auth.currentUser!.id;
    await _c
        .from('profiles')
        .update({'display_name': displayName, 'date_of_birth': dateOfBirth})
        .eq('id', uid);
  }

  // ─── Notifications (live via Supabase Realtime) ─────────────────────────────

  Stream<List<Map<String, dynamic>>> notificationsStream() {
    final uid = _c.auth.currentUser?.id;
    if (uid == null) return Stream.value(const []);
    return _c
        .from('notifications')
        .stream(primaryKey: ['id'])
        .eq('user_id', uid)
        .order('created_at');
  }

  Future<void> markNotificationRead(String id) async {
    await _c.from('notifications').update({'read': true}).eq('id', id);
  }

  Future<void> markAllNotificationsRead() async {
    final uid = _c.auth.currentUser?.id;
    if (uid == null) return;
    await _c.from('notifications').update({'read': true}).eq('user_id', uid).eq('read', false);
  }

  // ─── Strains & deals ────────────────────────────────────────────────────────

  Future<List<Map<String, dynamic>>> strains({String? type}) async {
    final base = _c.from('strains').select('slug,name,type,effects,thc_low,thc_high');
    final rows = await (type != null ? base.eq('type', type) : base).order('name');
    return rows.cast<Map<String, dynamic>>();
  }

  Future<Map<String, dynamic>?> strainBySlug(String slug) async {
    return _c.from('strains').select().eq('slug', slug).maybeSingle();
  }

  /// Products carrying a strain at active dispensaries (raw rows incl. dispensary).
  Future<List<Map<String, dynamic>>> productsForStrain(String strainId) async {
    final rows = await _c
        .from('products')
        .select('id,name,price_cents,image_urls,dispensary:dispensaries!inner(slug,name,status)')
        .eq('strain_id', strainId)
        .eq('dispensary.status', 'active')
        .order('price_cents');
    return rows.cast<Map<String, dynamic>>();
  }

  Future<List<Map<String, dynamic>>> deals() async {
    final now = DateTime.now().toUtc().toIso8601String();
    final rows = await _c
        .from('deals')
        .select('*, dispensary:dispensaries!inner(slug,name,city,state,status)')
        .eq('is_active', true)
        .lte('start_date', now)
        .gte('end_date', now)
        .eq('dispensary.status', 'active')
        .order('end_date');
    return rows.cast<Map<String, dynamic>>();
  }

  /// Native-push bridge: register an FCM/APNs token. Called by the Firebase
  /// messaging init on device (no-op on web). See the send-push edge function.
  Future<void> registerDeviceToken(String token, String platform) async {
    final uid = _c.auth.currentUser?.id;
    if (uid == null) return;
    await _c
        .from('device_tokens')
        .upsert({'user_id': uid, 'token': token, 'platform': platform}, onConflict: 'token');
  }

  // ─── Product detail, product reviews, brands ────────────────────────────────

  Future<Map<String, dynamic>?> productById(String id) async {
    return _c
        .from('products')
        .select(
          '*, dispensary:dispensaries(id,slug,name), strain:strains(slug,name), brand:brands(slug,name)',
        )
        .eq('id', id)
        .maybeSingle();
  }

  Future<List<Map<String, dynamic>>> productReviews(String productId) async {
    final rows = await _c
        .from('product_reviews')
        .select('id,rating,body,created_at')
        .eq('product_id', productId)
        .order('created_at', ascending: false);
    return rows.cast<Map<String, dynamic>>();
  }

  Future<void> submitProductReview(String productId, int rating, String? body) async {
    final uid = _c.auth.currentUser!.id;
    await _c.from('product_reviews').upsert(
      {'product_id': productId, 'user_id': uid, 'rating': rating, 'body': body},
      onConflict: 'product_id,user_id',
    );
  }

  Future<List<Map<String, dynamic>>> brands() async {
    final rows = await _c.from('brands').select('slug,name,description').order('name');
    return rows.cast<Map<String, dynamic>>();
  }

  Future<Map<String, dynamic>?> brandBySlug(String slug) async {
    return _c.from('brands').select().eq('slug', slug).maybeSingle();
  }

  Future<List<Map<String, dynamic>>> brandProducts(String brandId) async {
    final rows = await _c
        .from('products')
        .select(
          'id,dispensary_id,name,price_cents,image_urls,strain_type,thc_percentage,in_stock,dispensary:dispensaries!inner(slug,name,status)',
        )
        .eq('brand_id', brandId)
        .eq('dispensary.status', 'active')
        .order('price_cents');
    return rows.cast<Map<String, dynamic>>();
  }
}
