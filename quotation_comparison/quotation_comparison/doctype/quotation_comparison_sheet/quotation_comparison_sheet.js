// Copyright (c) 2023, efeone and contributors
// For license information, please see license.txt
frappe.ui.form.on('Quotation Comparison Sheet', {
    refresh: function(frm) {
        frm.trigger('set_query');
        if (!frm.doc.quotations.length) {
            frm.trigger('request_for_quotation');
        }
        set_custom_buttons(frm);
        apply_supplier_filter(frm);
        // if compare_quotation_by is set, then show the choose_quotation_and_supplier_for_item_section and section_break_nxowt sections
        if (frm.doc.compare_quotation_by) {
            frm.toggle_display('choose_quotation_and_supplier_for_item_section', true);
            frm.toggle_display('section_break_nxowt', true);
        }
    },
    request_for_quotation: function(frm) {
        set_quotation_against_rfq(frm);
        set_custom_buttons(frm);
        frm.clear_table('items');
    },
    set_query: function(frm) {
        frm.set_query('request_for_quotation', () => {
            return {
                filters: {
                    docstatus: 1
                }
            };
        });
    }
});

frappe.ui.form.on("Comparison Sheet Quotation", {
    quotations_remove(frm, cdt, cdn) {
        set_items_against_quotations(frm);
        apply_supplier_filter(frm);
    },
    quotation(frm, cdt, cdn) {
        set_items_against_quotations(frm);
        apply_supplier_filter(frm);
    }
});

var set_items_against_quotations = function(frm) {
    quotations = frm.doc.quotations;
    let dirty = false;
    let common_item_list = {};
    for (index in frm.doc.quotations) {
        qtn = frm.doc.quotations[index];
        quote = qtn["quotation"];
        if (quote){
            if (!dirty) {
                // first instance of quotation present
                frm.clear_table('quotation_items');
            }
            dirty = true;
            frappe.call({
                method: 'quotation_comparison.quotation_comparison.doctype.quotation_comparison_sheet.quotation_comparison_sheet.get_items_against_quotations',
                args: { 'quotation_name':  quote},
                callback: function(r) {
                    if (r && r.message) {
                        var quotation = r.message;
                        // var qtn = frm.add_child('quotations');
                        // qtn.quotation = quotation.name;
                        // qtn.supplier = quotation.supplier;
                        // qtn.date = quotation.transaction_date;
                        // qtn.grand_total = quotation.grand_total;
                        // qtn.terms = quotation.terms;
                        qtn.item_details = get_quotation_item_details(frm, quotation, common_item_list);
                        frm.refresh_field('quotations');
                        frm.refresh_field('quotation_items');            
                    }
                }
            });
        }
    }
    if (dirty) {
        frm.refresh_field('quotations');
        frm.refresh_field('quotation_items');            
    }
}

var set_quotation_against_rfq = function(frm) {
    if (frm.doc.request_for_quotation) {
        frm.clear_table('quotations');
        frm.clear_table('quotation_items');
        frappe.call({
            method: 'quotation_comparison.quotation_comparison.doctype.quotation_comparison_sheet.quotation_comparison_sheet.get_quotation_against_rfq',
            args: { 'rfq': frm.doc.request_for_quotation },
            callback: function(r) {
                if (r && r.message) {
                    var quotations = r.message;
                    let common_item_list = {}; 
                    quotations.forEach((quotation, i) => {
                        var qtn = frm.add_child('quotations');
                        qtn.quotation = quotation.name;
                        qtn.supplier = quotation.supplier;
                        qtn.date = quotation.transaction_date;
                        qtn.grand_total = quotation.grand_total;
                        qtn.terms = quotation.terms;
                        qtn.item_details = get_quotation_item_details(frm, quotation, common_item_list);
                    });
                    frm.refresh_field('quotations');
                    frm.refresh_field('quotation_items');
                    apply_supplier_filter(frm);
                }
            }
        });
        frm.refresh_field('quotations');
        frm.refresh_field('quotation_items');
    }
};

var get_quotation_item_details = function(frm, quotation, common_item_list = null) {
    var quotation_item_details_html = `<table border="1px grey"  bordercolor="silver" style="width: 100%; height="100"">
        <th><b>Item Name</b></th>
        <th><b>Quantity</b></th>
        <th style="text-align: right;"><b>Rate</b></th>
        <th style="text-align: right;"><b>Amount</b></th>
        <th style="text-align: center;"><b>UOM</b></th>
        <th><b>Description</b></th>`;

    quotation.items.forEach(function(val, i) {
        var i = i + 1;
        quotation_item_details_html += `<tr>`;
        quotation_item_details_html += `<td style="width: 8%">` + (val.item_name ? val.item_name : '') + "</td>";
        quotation_item_details_html += `<td style="width: 8%; text-align: right;">` + (val.qty ? val.qty : '') + "</td>";
        quotation_item_details_html += `<td style="width: 8%; text-align: right;">` + (val.rate ? val.rate : '') + "</td>";
        quotation_item_details_html += `<td style="width: 8%; text-align: right;">` + (val.amount ? val.amount : '') + "</td>";
        quotation_item_details_html += `<td style="width: 8%">` + (val.uom ? val.uom : '') + "</td>";
        quotation_item_details_html += `<td style="width: 14% word-wrap: break-all" contenteditable = 'false'>` + (val.description ? val.description : '') + "</td>";
        quotation_item_details_html += `</tr>`;
        if (common_item_list == null){
            set_quotation_item_details(frm, val, quotation);
        }
    });

    if (common_item_list !=null){
        // Collect all items from all quotations and group by item name
        quotation.items.forEach(function(val) {
            item_code = val.item_code;
            if (common_item_list[item_code]) {
                // BUG: val is being taken as string
                // TODO: make it 
                common_item_list[item_code].push({item: val, quotation: quotation});
            } else {
                common_item_list[item_code] = [{item: val, quotation: quotation}];
            }
        });

        frm.clear_table('quotation_items');  // common_item_list will have all items, clear the old table first
        // Process items grouped by item name
        Object.keys(common_item_list).forEach(function(item_code) {
            var entries = common_item_list[item_code];
            entries.forEach(function(entry) {
                var val = entry.item;
                var quotation = entry.quotation;

                set_quotation_item_details(frm, val, quotation);
            });
        });
    }

    quotation_item_details_html += `</table>`;
    return quotation_item_details_html;
};

var set_quotation_item_details = function(frm, item, quotation) {
    var qtn_item = frm.add_child('quotation_items');
    qtn_item.quotation = item.parent;
    qtn_item.supplier = quotation.supplier;
    qtn_item.quotation_item = item.name;
    qtn_item.item_code = item.item_code;
    qtn_item.item_name = item.item_name;
    qtn_item.description = item.description;
    qtn_item.delivery_date = quotation.transaction_date;
    qtn_item.qty = item.qty;
    qtn_item.uom = item.uom;
    let sgst = item.sgst_rate || 0;
    let cgst = item.cgst_rate || 0;
    let igst = item.igst_rate || 0;
    let total_tax_percent = sgst + cgst + igst;
    const listRate = item.price_list_rate || 0;   // price before discount
    const discRate = item.rate || listRate;   // after discount
    const rate_inc_disc  = discRate * (1 + total_tax_percent / 100);
    const rate_inc_nodisc = listRate * (1 + total_tax_percent / 100);
    qtn_item.price_list_rate = listRate;
    qtn_item.discount_percentage = listRate ? ((listRate - discRate) / listRate * 100) : 0;
    qtn_item.rate   = rate_inc_disc;
    qtn_item.amount = rate_inc_disc * item.qty; // amount after discount
    qtn_item.final_amount = rate_inc_disc * item.qty;
    qtn_item.warehouse = item.warehouse;
};

let set_custom_buttons = function(frm) {
    if (!frm.is_new() && (frm.doc.docstatus == 0)) {
        //best_price_same_supplier
        frm.add_custom_button('Best Rate from One Supplier', () => {
            order_items_by_filter(frm, 'best_price_same_supplier');
        }, 'Analyse');

        // best_price_many_suppliers
        frm.add_custom_button('Best Rate from Many Supplier', () => {
            order_items_by_filter(frm, 'best_price_many_supplier');
        }, 'Analyse');

        // Custom 
        frm.add_custom_button('Custom Select', () => {
            fetch_quotation_items(frm);
        }, 'Analyse');
    }
    if (frm.doc.docstatus == 1) {
        //Create Purchase Orders
        if (frm.doc.compare_quotation_by && frm.doc.items && !frm.doc.po_created) {
            if (frm.doc.compare_quotation_by == 'Whole Quotation') {
                frm.add_custom_button('Purchase Order', () => {
                    create_purchase_orders(frm);
                }, 'Create');
            }
            if (frm.doc.compare_quotation_by == 'Item Wise') {
                frm.add_custom_button('Purchase Orders', () => {
                    create_purchase_orders(frm);
                }, 'Create');
            }
        }
    }
};

let order_items_by_filter = function(frm, type) {
    if (!frm.is_dirty()) {
        frm.call('order_items_by_filter', {
            type: type
        }).then(
            res => {
                frm.reload_doc();
            }
        );
    } else {
        frappe.throw(__('Please save document before Analyse..'));
    }
};

let create_purchase_orders = function(frm, type) {
    frm.call('create_purchase_orders').then(
        res => {
            frm.reload_doc();
        }
    );
};

// Function to fetch and set items from quotation items
let fetch_quotation_items = function(frm) {
    if (frm.is_dirty()) {
        frappe.throw(__('Please save document before Analyse..'));
    }
    let quotation_items = frm.doc.quotation_items;
    frm.clear_table('items');
    frm.doc.compare_quotation_by = 'Item Wise';
    quotation_items.forEach(item => {
		// 	best_price_item.date = ('Supplier Quotation', item.quotation, 'transaction_date')
		// 	best_price_item.delivery_date = item.delivery_date
        let new_item = frm.add_child('items');
        new_item.delivery_date = item.delivery_date;
        new_item.quotation = item.quotation;
        new_item.supplier = item.supplier;
        new_item.item_code = item.item_code;
        new_item.item_name = item.item_name;
        new_item.description = item.description;
        new_item.warehouse = item.warehouse;
        new_item.qty = item.qty;
        new_item.price_list_rate = item.price_list_rate;
        new_item.discount_percentage = item.discount_percentage;
        new_item.rate  = item.rate;
        new_item.uom = item.uom;
        new_item.amount = item.rate * item.qty;
        new_item.final_amount = new_item.amount;
    });
    frm.refresh_field('items');
    frm.save();
};

// Auto-update item row when supplier is changed -------------------
frappe.ui.form.on('Quotation Comparison Sheet Item', {
    supplier: function(frm, cdt, cdn) {
        const row = locals[cdt][cdn];
        if (!row.item_code || !row.supplier) {return;}

        // find matching quotation_items entry
        const match = (frm.doc.quotation_items || []).find(qi =>
            qi.item_code === row.item_code && qi.supplier === row.supplier);

        if (match) {
            // copy relevant fields
            row.price_list_rate = match.price_list_rate;
            row.discount_percentage = match.discount_percentage;
            row.rate        = match.rate;
            row.qty         = match.qty;
            row.amount      = match.rate * row.qty;
            row.final_amount= match.rate * row.qty;
            row.quotation   = match.quotation;
            row.delivery_date = match.delivery_date;
            row.uom         = match.uom;
            row.warehouse   = match.warehouse;
            row.description = match.description;
        } else {
            frappe.throw(__('No matching quotation item found for this supplier and item code.'));
        }
        recompute_totals(frm);
        frm.refresh_field('items');
        frm.refresh_field('grand_total');
    }
});

// Recalculate grand total based on final_amount
function recompute_totals(frm){
    const total = (frm.doc.items || []).reduce((acc,row)=> acc + (parseFloat(row.final_amount) || 0),0);
    frm.doc.grand_total = total;
}

// ---- helper: keep only suppliers that gave quotations -------------
function apply_supplier_filter(frm) {
    if (!frm.doc || !frm.doc.quotations) return;

    // build a list like ["Supplier A", "Supplier B"]
    const supplier_list = [...new Set(
        frm.doc.quotations.map(q => q.supplier).filter(Boolean)
    )];

    // limit drop-down in Items table
    frm.set_query('supplier', 'items', () => {
        return { filters: { name: ['in', supplier_list] } };
    });
    // limit drop-down in Quotation Items table (if needed)
    frm.set_query('supplier', 'quotation_items', () => {
        return { filters: { name: ['in', supplier_list] } };
    });
}