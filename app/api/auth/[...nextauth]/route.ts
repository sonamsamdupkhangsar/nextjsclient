import NextAuth, { NextAuthOptions } from "next-auth";
//import GithubProvider from "next-auth/providers/github";
//import GoogleProvider from "next-auth/providers/google";
import { URLSearchParams } from "url"
import { OAuthChecks, OAuthConfig } from "next-auth/providers"
import { CallbackParamsType, BaseClient } from "openid-client"
import jwt_decode, { jwtDecode } from 'jwt-decode'
/*
export const authOptions: NextAuthOptions = {
  // Configure one or more authentication providers
  providers: [
    GithubProvider({
      clientId: process.env.GITHUB_CLIENT_ID as string,
      clientSecret: process.env.GITHUB_SECRET_ID as string,
    }),
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_SECRET_ID as string,
    }),
  ],
  secret: process.env.NEXTAUTH_SECRET as string,
};
*/




const host = process.env.API_GATEWAY //"http://localhost:8080"
//const host = "http://api-gateway.sonam.cloud"

// import AppleProvider from "next-auth/providers/apple"
// import EmailProvider from "next-auth/providers/email"

// For more information on each option (and a full list of options) go to
// https://next-auth.js.org/configuration/options
export const authOptions: NextAuthOptions = {
  providers: [
  
    {
      id: "myauth",
      name: "SonamCloud",
      type: "oauth",
      clientId: "nextjs-client",
      authorization: {
        url:  host+ "/oauth2-token-mediator/authorize",
        params: { scope: "openid email profile" }
       },       
      token: {
        url: host + "/oauth/token", 

        async request(context) {
          console.log("code: %s, redirect_uri: %s", context.params.code, context.params.redirect_uri)
          const tokens = await makeTokenRequest(context)          
          console.log('tokens: ', tokens)
          return { tokens }
        }         
      },
     
      idToken: true,      
      checks: ["pkce", "state"],
      profile(profile) {
        return {
          id: profile.sub,
          name: profile.name,
          email: profile.email,
          image: profile.picture          
        }
      },
    }
  ],
  theme: {
    colorScheme: "light",
  },
  callbacks: {
    async jwt({ token, user, account }) {
      console.log("user: ", user)

      
      
      token.userRole = "admin"      
      console.log('token: ', token)    
      
      if (account) {
        console.log('account: ', account)
        
        token = Object.assign({}, token, { access_token: account.access_token, refresh_token: account.refresh_token });        
        
        var map = jwtDecode("" + account.access_token) as any
        console.log("parse jwt token: ", map)
        console.log("userRole: ", map.userRole)
        var userRoles = <Array<string>> map.userRole
        if (userRoles.includes('admin')) {
          token.userRole = "admin";
          console.log("set token.userRole to admin");
        }
        
        

        console.log("account expires at: ", account.expires_at)
       // token.refreshToken = account.refresh_token        
       // token.accessToken = account.access_token
        if (account.refresh_token) {
          token.accessTokenExpires =  account.expires_at!  * 1000 //seconds * 1000 = milliseconds         
        }
      }

      // If token has not expired, return it,
      if (Date.now() <  (Number(token.accessTokenExpires))) {
        //Date.now() returns number of milliseconds since epoch
        console.log("token.accessTokenExpires is not expired, Date.now(): ", Date.now(),
        ", token.accessTokenExpires: ", token.accessTokenExpires)
       // return token
      }

      // Otherwise, refresh the token.
      var tokens = await refreshAccessToken(token)
      console.log('token from refresh: ', tokens)
      token = Object.assign({}, token, { access_token: tokens.access_token, refresh_token: tokens.refresh_token });        
      return token
    
      
    },

    async session({session, token}) {
      if(session) {
        session = Object.assign({}, session, {access_token: token.access_token})
        console.log('session: ', session);
        }
      return session
      }
  },
}

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };

async function makeTokenRequest(context: { params: CallbackParamsType; checks: OAuthChecks } & { client: BaseClient; provider: OAuthConfig<{ [x: string]: unknown }> & { signinUrl: string; callbackUrl: string } }) {
  console.log("params: ",context.params)
  console.log('host: ', host, ', nextAuthUrl: ', process.env.NEXTAUTH_URL)
  const request = await fetch(host + '/oauth2-token-mediator/token?grant_type='    
    +'authorization_code&code='+context.params.code
    +'&client_id=nextjs-client&'
    +'&redirect_uri='+process.env.NEXTAUTH_URL+'/api/auth/callback/myauth'
    +'&scope=openid%20email%20profile', {
           
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',            
              'client_id': 'nextjs-client'
            }
          }).then( function(response) {
            return response.json();
          }).then(function(data) {          
            return data;
          });
          return request;
}

/**
 * Takes a token, and returns a new token with updated
 * `accessToken` and `accessTokenExpires`. If an error occurs,
 * returns the old token and an error property
 */
async function refreshAccessToken(token: any) {
  console.log('refresh token: ', token.refresh_token);  
  const url =
      host + "/oauth2-token-mediator/token?" +      
      new URLSearchParams({
        client_id: "nextjs-client",        
        grant_type: "refresh_token",
        refresh_token: token.refresh_token      
      })

  const response = await fetch(url, {
    headers: {
      "client_id": "nextjs-client"
    },
    method: "POST",
  }).then(function(response) {
      if (!response.ok)
        throw new Error("failed to refresh token")
      else  
        return response.json()
    }).then(function(data) {
      return data;
    })
    return response;
}