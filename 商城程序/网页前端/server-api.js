(function () {
    "use strict";

    function request(method, url, body, async) {
        const xhr = new XMLHttpRequest();
        xhr.open(method, url, async !== false);
        xhr.setRequestHeader("Content-Type", "application/json");
        if (async === false) {
            xhr.send(body == null ? null : JSON.stringify(body));
            let payload = {};
            try { payload = JSON.parse(xhr.responseText || "{}"); } catch (error) {}
            if (xhr.status < 200 || xhr.status >= 300) {
                const error = new Error(payload.error || "服务器操作失败"); error.status = xhr.status; throw error;
            }
            return payload;
        }
        return fetch(url, { method: method, headers: { "Content-Type": "application/json" }, credentials: "same-origin", body: body == null ? undefined : JSON.stringify(body) }).then(async function (response) {
            const payload = await response.json().catch(function () { return {}; });
            if (!response.ok) throw new Error(payload.error || "服务器操作失败");
            return payload;
        });
    }

    window.serverApi = {
        enabled: /^https?:$/.test(location.protocol),
        getState: function (fallbackData) {
            if (!this.enabled) return fallbackData;
            try { return request("GET", "/api/state", null, false).data; }
            catch (error) {
                if (error.status !== 404) throw error;
                request("POST", "/api/state/seed", { data: fallbackData }, false);
                return request("GET", "/api/state", null, false).data;
            }
        },
        operation: function (type, payload) { return request("POST", "/api/operation", { type: type, payload: payload || {} }, false); },
        login: function (account, password) { return request("POST", "/api/auth/login", { account: account, password: password }); },
        register: function (values) { return request("POST", "/api/auth/register", values); },
        logout: function () { return request("POST", "/api/auth/logout", {}); },
        session: function () { return request("GET", "/api/auth/session", null); },
        changePassword: function (password) { return request("PATCH", "/api/auth/password", { password: password }); },
        changeAccount: function (phone) { return request("PATCH", "/api/auth/account", { phone: phone }); },
        profile: function () { return request("GET", "/api/profile", null, false); },
        saveAddress: function (address) { return request("PUT", "/api/profile/address", address, false); },
        couponState: function () { return request("GET", "/api/coupons", null, false); },
        claimCoupon: function (campaignId) { return request("POST", "/api/coupons/claim", { campaignId: campaignId }, false); },
        support: function (message, history) { return request("POST", "/api/support", { message: message, history: history || [] }); }
    };
})();
